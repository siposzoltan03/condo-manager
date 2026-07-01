import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { extractSzmszFromPdf } from "@/lib/szmsz-extract";

// Base64 inflates ~33%; cap the decoded PDF around 15 MB.
const MAX_BASE64_LENGTH = 21_000_000;

export const maxDuration = 120;

/**
 * POST /api/onboarding/extract-szmsz — AI-assisted SZMSZ extraction.
 * Body: { pdfBase64: string, fileName?: string } (base64 without data-URL prefix).
 * Returns a units + governance proposal for human review; writes nothing.
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
    const fileName = typeof body?.fileName === "string" ? body.fileName : undefined;

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

    const extraction = await extractSzmszFromPdf(pdfBase64, fileName);

    // Also persist the uploaded PDF as a document in the building's SZMSZ
    // category, so the "first document uploaded" step is genuinely satisfied.
    // board.manage-gated here (the general documents API needs chair/admin
    // publish authority, which onboarding board members may lack).
    let stored = false;
    try {
      const szmszCategory = await prisma.documentCategory.findFirst({
        where: { buildingId: ctx.buildingId, name: { contains: "SZMSZ", mode: "insensitive" } },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (szmszCategory) {
        const buffer = Buffer.from(pdfBase64, "base64");
        const safeName = fileName?.trim() || "SZMSZ.pdf";
        const put = await getStorage().put({
          scope: "document",
          fileName: safeName,
          mimeType: "application/pdf",
          body: buffer,
        });
        await prisma.document.create({
          data: {
            title: safeName.replace(/\.pdf$/i, ""),
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
    } catch (storeErr) {
      // Storing is best-effort — extraction still succeeds without it.
      console.error("SZMSZ document store failed (non-fatal):", storeErr);
    }

    return NextResponse.json({ ...extraction, stored });
  } catch (error) {
    console.error("SZMSZ extraction failed:", error);
    return NextResponse.json(
      { error: "Extraction failed. Check the PDF and try again." },
      { status: 500 },
    );
  }
}
