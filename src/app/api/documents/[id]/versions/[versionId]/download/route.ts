import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    const { id, versionId } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        category: { select: { buildingId: true } },
      },
    });

    if (!document || document.category.buildingId !== buildingId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Visibility check
    if (document.visibility === "ADMIN_ONLY" && !allows(ctx, "view.adminContext")) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (document.visibility === "BOARD_ONLY" && !allows(ctx, "view.boardContext")) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const version = await prisma.documentVersion.findFirst({
      where: { id: versionId, documentId: id },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // In a production app, this would stream the file from storage (S3, etc.).
    // Since this is a demo without real file storage, return a placeholder response.
    return new NextResponse(
      `File preview is not available.\n\nDocument: ${document.title}\nFile: ${version.fileName}\nSize: ${version.fileSize} bytes\nType: ${version.mimeType}`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${version.fileName}"`,
        },
      }
    );
  } catch (error) {
    console.error("Failed to download document version:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
