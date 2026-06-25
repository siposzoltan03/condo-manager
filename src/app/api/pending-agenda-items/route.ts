import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/pending-agenda-items
 *   ?status=unattached  → items with no meeting yet (default)
 *   ?status=attached    → items already linked to a meeting (still unresolved)
 *   ?status=resolved    → resolved items
 *   ?meetingId=X        → items attached to a specific meeting
 */
export async function GET(request: NextRequest) {
  try {
    const { buildingId } = await requireBuildingContext();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? "unattached";
    const meetingId = searchParams.get("meetingId");

    const where: import("@prisma/client").Prisma.PendingAgendaItemWhereInput = {
      buildingId,
    };
    if (meetingId) {
      where.attachedMeetingId = meetingId;
    } else {
      switch (status) {
        case "attached":
          where.attachedMeetingId = { not: null };
          where.resolvedAt = null;
          break;
        case "resolved":
          where.resolvedAt = { not: null };
          break;
        case "unattached":
        default:
          where.attachedMeetingId = null;
          where.resolvedAt = null;
          break;
      }
    }

    const items = await prisma.pendingAgendaItem.findMany({
      where,
      include: {
        complaint: {
          select: { id: true, trackingNumber: true, title: true },
        },
        resignation: {
          select: {
            id: true,
            userBuilding: {
              select: { user: { select: { id: true, name: true } } },
            },
          },
        },
        attachedMeeting: { select: { id: true, title: true, date: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        description: i.description,
        complaintId: i.complaintId,
        complaintTrackingNumber: i.complaint?.trackingNumber ?? null,
        resignationId: i.resignationId,
        resignationResidentName:
          i.resignation?.userBuilding.user.name ?? null,
        attachedMeetingId: i.attachedMeetingId,
        attachedMeeting: i.attachedMeeting
          ? {
              id: i.attachedMeeting.id,
              title: i.attachedMeeting.title,
              date: i.attachedMeeting.date.toISOString(),
            }
          : null,
        createdById: i.createdById,
        createdByName: i.createdBy.name,
        createdAt: i.createdAt.toISOString(),
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
        resolutionNote: i.resolutionNote,
      })),
    });
  } catch (error) {
    console.error("Failed to list pending-agenda items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
