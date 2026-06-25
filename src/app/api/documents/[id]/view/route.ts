import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { DocumentVisibility } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Increment viewCount + lastAccessedAt. Called when the version panel opens
 * for a document. Visibility-checked.
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

    const updated = await prisma.document.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
      select: { viewCount: true, lastAccessedAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to record document view:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
