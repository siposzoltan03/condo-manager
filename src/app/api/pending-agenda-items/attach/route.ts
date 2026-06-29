import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

interface AttachBody {
  meetingId: string;
  itemIds: string[];
}

/**
 * Bulk-attach pending agenda items to a meeting. Used by:
 *   1. Inline picker in the meeting create flow (after the meeting was just
 *      created, attach the selected items to it).
 *   2. Edit-meeting flow / standalone "attach pending items" inbox.
 *
 * Pass `meetingId: ""` to *detach* instead — items are returned to the queue.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    if (!allows(ctx, "vote.start")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { meetingId, itemIds } = (await request.json()) as AttachBody;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds required" }, { status: 400 });
    }

    if (meetingId) {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { buildingId: true },
      });
      if (!meeting || meeting.buildingId !== buildingId) {
        return NextResponse.json({ error: "Invalid meeting" }, { status: 400 });
      }
    }

    // Verify all items belong to this building.
    const items = await prisma.pendingAgendaItem.findMany({
      where: { id: { in: itemIds }, buildingId },
      select: { id: true },
    });
    if (items.length !== itemIds.length) {
      return NextResponse.json(
        { error: "Some items not found in this building" },
        { status: 404 },
      );
    }

    await prisma.pendingAgendaItem.updateMany({
      where: { id: { in: itemIds } },
      data: { attachedMeetingId: meetingId || null },
    });

    return NextResponse.json({ ok: true, attached: items.length, userId });
  } catch (error) {
    console.error("Failed to attach pending-agenda items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
