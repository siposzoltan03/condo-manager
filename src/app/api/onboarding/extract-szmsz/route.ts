import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { szmszQueue } from "@/lib/queue";

// Base64 inflates ~33%; cap the decoded PDF around 15 MB.
const MAX_BASE64_LENGTH = 21_000_000;

/**
 * POST /api/onboarding/extract-szmsz — start an async SZMSZ AI extraction.
 * Body: { pdfBase64, fileName? }. Uploads the PDF, stores it as a Bylaws
 * document (best-effort), enqueues a background extraction job, and returns
 * `{ jobId, stored }` immediately. The client polls GET .../[jobId] for the
 * result — the OpenAI call runs in the worker (no request timeout).
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
    const fileName =
      typeof body?.fileName === "string" && body.fileName.trim()
        ? body.fileName.trim()
        : "SZMSZ.pdf";

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

    // Persist as a Bylaws-category document (best-effort) so the "first
    // document uploaded" step is satisfied. board.manage-gated here.
    let stored = false;
    try {
      const szmszCategory = await prisma.documentCategory.findFirst({
        where: { buildingId: ctx.buildingId, name: { contains: "SZMSZ", mode: "insensitive" } },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      const title = fileName.replace(/\.pdf$/i, "");
      if (szmszCategory) {
        // Dedupe: don't pile up documents when the same SZMSZ is re-uploaded
        // (e.g. retries). If one with this title already exists in the
        // category, treat it as stored and skip creating another.
        const existingDoc = await prisma.document.findFirst({
          where: { categoryId: szmszCategory.id, title, isArchived: false },
          select: { id: true },
        });
        if (existingDoc) {
          stored = true;
        } else {
        await prisma.document.create({
          data: {
            title,
            categoryId: szmszCategory.id,
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
        stored = true;
        }
      }
    } catch (storeErr) {
      console.error("SZMSZ document store failed (non-fatal):", storeErr);
    }

    const jobRec = await prisma.szmszExtractionJob.create({
      data: {
        buildingId: ctx.buildingId,
        createdById: ctx.userId,
        storageKey: put.key,
        fileName,
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
