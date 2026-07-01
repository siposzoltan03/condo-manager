import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
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
    return NextResponse.json(extraction);
  } catch (error) {
    console.error("SZMSZ extraction failed:", error);
    return NextResponse.json(
      { error: "Extraction failed. Check the PDF and try again." },
      { status: 500 },
    );
  }
}
