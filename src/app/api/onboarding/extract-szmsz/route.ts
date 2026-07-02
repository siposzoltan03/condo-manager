import { NextRequest, NextResponse } from "next/server";
import type { LegalDocKind } from "@prisma/client";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { szmszQueue } from "@/lib/queue";

// Base64 inflates ~33%; cap the decoded PDF around 15 MB.
const MAX_BASE64_LENGTH = 21_000_000;

// Document kinds this endpoint can extract from.
const EXTRACTABLE_KINDS = ["FOUNDING_DEED", "SZMSZ", "COMBINED"] as const;
type ExtractableKind = (typeof EXTRACTABLE_KINDS)[number];

/**
 * Category name pattern a document of this kind is filed under. FOUNDING_DEED
 * and COMBINED go to "Alapító okirat" (the register); SZMSZ to "SZMSZ". Matched
 * with `contains` so renamed / legacy categories still resolve.
 */
function categoryPatternFor(docKind: ExtractableKind): string {
  return docKind === "SZMSZ" ? "SZMSZ" : "alapító okirat";
}

/**
 * POST /api/onboarding/extract-szmsz — start an async legal-document AI
 * extraction. Body: { pdfBase64, fileName?, docKind? }. docKind decides which
 * sections are extracted (FOUNDING_DEED → units, SZMSZ → governance, COMBINED →
 * both; defaults to COMBINED). Uploads the PDF, files it as a typed document in
 * the matching category (best-effort), enqueues a background extraction job,
 * and returns `{ jobId, stored }` immediately. The client polls GET .../[jobId]
 * for the result — the OpenAI call runs in the worker (no request timeout).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "board.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const pdfBase64 = body?.pdfBase64;
    const docKind: ExtractableKind = EXTRACTABLE_KINDS.includes(body?.docKind)
      ? (body.docKind as ExtractableKind)
      : "COMBINED";
    const fileName =
      typeof body?.fileName === "string" && body.fileName.trim()
        ? body.fileName.trim()
        : docKind === "SZMSZ"
          ? "SZMSZ.pdf"
          : "Alapito_okirat.pdf";

    if (typeof pdfBase64 !== "string" || pdfBase64.length === 0) {
      return NextResponse.json({ error: "Missing pdfBase64" }, { status: 400 });
    }
    if (pdfBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: "File too large (max ~15 MB)" }, { status: 413 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI extraction is not configured (missing OPENAI_API_KEY)." },
        { status: 503 },
      );
    }

    // Upload the PDF once; reuse the key for both the stored document and the
    // extraction job (the worker reads the PDF back from storage).
    const put = await getStorage().put({
      scope: "document",
      fileName,
      mimeType: "application/pdf",
      body: Buffer.from(pdfBase64, "base64"),
    });

    // File as a typed document in the matching category (best-effort) so the
    // "first document uploaded" step is satisfied. board.manage-gated here.
    let stored = false;
    try {
      const category = await prisma.documentCategory.findFirst({
        where: {
          buildingId: ctx.buildingId,
          name: { contains: categoryPatternFor(docKind), mode: "insensitive" },
        },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      const title = fileName.replace(/\.pdf$/i, "");
      if (category) {
        // If a same-titled document already exists, append a new version
        // (preserving history) rather than creating a duplicate. Otherwise
        // create the document at version 1.
        const existingDoc = await prisma.document.findFirst({
          where: { categoryId: category.id, title, isArchived: false },
          select: {
            id: true,
            versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true } },
          },
        });
        if (existingDoc) {
          await prisma.documentVersion.create({
            data: {
              documentId: existingDoc.id,
              versionNumber: (existingDoc.versions[0]?.versionNumber ?? 0) + 1,
              fileUrl: put.url,
              fileName: put.fileName,
              fileSize: put.fileSize,
              mimeType: put.mimeType,
              uploadedById: ctx.userId,
            },
          });
          await prisma.document.update({
            where: { id: existingDoc.id },
            data: { updatedAt: new Date(), kind: docKind as LegalDocKind },
          });
        } else {
          await prisma.document.create({
            data: {
              title,
              categoryId: category.id,
              kind: docKind as LegalDocKind,
              visibility: "BOARD_ONLY",
              uploadedById: ctx.userId,
              versions: {
                create: {
                  versionNumber: 1,
                  fileUrl: put.url,
                  fileName: put.fileName,
                  fileSize: put.fileSize,
                  mimeType: put.mimeType,
                  uploadedById: ctx.userId,
                },
              },
            },
          });
        }
        stored = true;
      }
    } catch (storeErr) {
      console.error("Legal-doc store failed (non-fatal):", storeErr);
    }

    const jobRec = await prisma.szmszExtractionJob.create({
      data: {
        buildingId: ctx.buildingId,
        createdById: ctx.userId,
        storageKey: put.key,
        fileName,
        docKind: docKind as LegalDocKind,
      },
    });
    await szmszQueue.add("extract", { jobId: jobRec.id });

    return NextResponse.json({ jobId: jobRec.id, stored }, { status: 202 });
  } catch (error) {
    console.error("SZMSZ extraction enqueue failed:", error);
    return NextResponse.json(
      { error: "Could not start extraction. Try again." },
      { status: 500 },
    );
  }
}
