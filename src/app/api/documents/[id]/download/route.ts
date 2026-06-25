import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { DocumentVisibility } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Increment downloadCount + lastAccessedAt and return the latest version's
 * file URL. Called when the user clicks Letöltés.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { buildingId, role } = await requireBuildingContext();
    const { id } = await context.params;

    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        visibility: true,
        category: { select: { buildingId: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { fileUrl: true, fileName: true, mimeType: true },
        },
      },
    });

    if (!doc || doc.category.buildingId !== buildingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      doc.visibility !== DocumentVisibility.PUBLIC &&
      !hasMinimumRole(role, "BOARD_MEMBER")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      doc.visibility === DocumentVisibility.ADMIN_ONLY &&
      !hasMinimumRole(role, "ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const version = doc.versions[0];
    if (!version) {
      return NextResponse.json({ error: "No versions" }, { status: 404 });
    }

    await prisma.document.update({
      where: { id },
      data: {
        downloadCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    return NextResponse.json({
      fileUrl: version.fileUrl,
      fileName: version.fileName,
      mimeType: version.mimeType,
    });
  } catch (error) {
    console.error("Failed to record document download:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
