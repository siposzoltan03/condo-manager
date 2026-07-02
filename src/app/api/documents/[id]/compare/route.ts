import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { extractTextFromFile } from "@/lib/documents/extract-text";
import { diffLines } from "diff";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

interface VersionRow {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  extractedText: string | null;
}

/** Text for a version — cached on the row after first extraction. */
async function textForVersion(v: VersionRow): Promise<string> {
  if (v.extractedText != null) return v.extractedText;
  const key = v.fileUrl.replace(/^\/api\/files\//, "");
  try {
    const { body } = await getStorage().read(key);
    const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body);
    const text = await extractTextFromFile(buffer, v.mimeType, v.fileName);
    await prisma.documentVersion.update({
      where: { id: v.id },
      data: { extractedText: text },
    });
    return text;
  } catch (e) {
    console.error(`Text extraction failed for version ${v.id}:`, e);
    return "";
  }
}

/**
 * GET /api/documents/[id]/compare?a=<versionId>&b=<versionId>
 * Line diff of two versions' extracted text (extracted + cached on demand).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { id } = await context.params;
    const a = request.nextUrl.searchParams.get("a");
    const b = request.nextUrl.searchParams.get("b");
    if (!a || !b) {
      return NextResponse.json({ error: "Missing version ids (a, b)" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        visibility: true,
        category: { select: { buildingId: true } },
        versions: {
          where: { id: { in: [a, b] } },
          select: {
            id: true,
            versionNumber: true,
            fileUrl: true,
            fileName: true,
            mimeType: true,
            extractedText: true,
          },
        },
      },
    });
    if (!doc || doc.category.buildingId !== ctx.buildingId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    // Visibility gate — mirror the documents list.
    if (doc.visibility === "BOARD_ONLY" && !allows(ctx, "view.boardContext")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (doc.visibility === "ADMIN_ONLY" && !allows(ctx, "view.adminContext")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const va = doc.versions.find((v) => v.id === a);
    const vb = doc.versions.find((v) => v.id === b);
    if (!va || !vb) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const [textA, textB] = await Promise.all([textForVersion(va), textForVersion(vb)]);
    const diff = diffLines(textA, textB).map((p) => ({
      value: p.value,
      added: !!p.added,
      removed: !!p.removed,
    }));

    return NextResponse.json({
      a: { id: va.id, versionNumber: va.versionNumber, hasText: textA.length > 0 },
      b: { id: vb.id, versionNumber: vb.versionNumber, hasText: textB.length > 0 },
      diff,
    });
  } catch (error) {
    console.error("Version compare failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
