import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { documentPinToggled } from "@/lib/documents/events";

type RouteContext = { params: Promise<{ id: string }> };

/** Toggle isPinned on a Document. Board+ only. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    if (!allows(ctx, "document.publish.public")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { pinned?: boolean };

    const doc = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        isPinned: true,
        category: { select: { buildingId: true } },
      },
    });

    if (!doc || doc.category.buildingId !== buildingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const next = body.pinned !== undefined ? body.pinned : !doc.isPinned;

    const updated = await prisma.document.update({
      where: { id },
      data: { isPinned: next },
      select: { id: true, isPinned: true },
    });

    await documentPinToggled({
      documentId: id,
      toggledByUserId: userId,
      buildingId,
      oldPinned: doc.isPinned,
      newPinned: next,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to toggle document pin:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
