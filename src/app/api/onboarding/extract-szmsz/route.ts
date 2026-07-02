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
    // Optional: append the upload as a new version of a specific existing
    // document (the amend-founding-deed flow) rather than title-matching.
    const targetDocumentId =
      typeof body?.documentId === "string" && body.documentId ? body.documentId : null;
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

    // File as a typed document (best-effort). For the amend flow a specific
    // target document is given → append the new version to it; otherwise file
    // into the matching category, appending to a same-titled doc or creating
    // one. Capture the resulting version id so the caller can amend from it.
    let stored = false;
    let documentId: string | null = null;
    let versionId: string | null = null;
    try {
      const versionData = {
        fileUrl: put.url,
        fileName: put.fileName,
        fileSize: put.fileSize,
        mimeType: put.mimeType,
        uploadedById: ctx.userId,
      };

      let targetDoc: { id: string; nextVersion: number } | null = null;
      if (targetDocumentId) {
        // Amend flow: append to this exact document (must be this building's).
        const doc = await prisma.document.findUnique({
          where: { id: targetDocumentId },
          select: {
            id: true,
            category: { select: { buildingId: true } },
            versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true } },
          },
        });
        if (doc && doc.category.buildingId === ctx.buildingId) {
          targetDoc = { id: doc.id, nextVersion: (doc.versions[0]?.versionNumber ?? 0) + 1 };
        }
      } else {
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
          const existingDoc = await prisma.document.findFirst({
            where: { categoryId: category.id, title, isArchived: false },
            select: {
              id: true,
              versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true } },
            },
          });
          if (existingDoc) {
            targetDoc = { id: existingDoc.id, nextVersion: (existingDoc.versions[0]?.versionNumber ?? 0) + 1 };
          } else {
            const created = await prisma.document.create({
              data: {
                title,
                categoryId: category.id,
                kind: docKind as LegalDocKind,
                visibility: "BOARD_ONLY",
                uploadedById: ctx.userId,
                versions: { create: { versionNumber: 1, ...versionData } },
              },
              select: { id: true, versions: { select: { id: true } } },
            });
            documentId = created.id;
            versionId = created.versions[0]?.id ?? null;
            stored = true;
          }
        }
      }

      if (targetDoc) {
        const v = await prisma.documentVersion.create({
          data: { documentId: targetDoc.id, versionNumber: targetDoc.nextVersion, ...versionData },
          select: { id: true },
        });
        await prisma.document.update({
          where: { id: targetDoc.id },
          data: { updatedAt: new Date(), kind: docKind as LegalDocKind },
        });
        documentId = targetDoc.id;
        versionId = v.id;
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

    return NextResponse.json({ jobId: jobRec.id, stored, documentId, versionId }, { status: 202 });
  } catch (error) {
    console.error("SZMSZ extraction enqueue failed:", error);
    return NextResponse.json(
      { error: "Could not start extraction. Try again." },
      { status: 500 },
    );
  }
}
