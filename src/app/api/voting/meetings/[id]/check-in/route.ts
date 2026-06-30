import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/voting/meetings/[id]/check-in
 *
 * Self check-in: a member registers their OWN owned unit(s) as present for a
 * LIVE assembly. This is what makes "you can only vote if present" work for
 * remote/hybrid attendees — the companion calls it on joining the live view,
 * the same way the board uses "Érkeztetés" for people in the room.
 *
 * Only owners have votable units, so we check in the caller's OWNER units.
 * Idempotent (upsert). No body.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id: meetingId } = await context.params;
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, buildingId: true, liveStatus: true },
    });
    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    // Self check-in is only meaningful while the session is running.
    if (meeting.liveStatus !== "LIVE") {
      return NextResponse.json({ error: "Meeting is not live" }, { status: 400 });
    }

    // The caller's owned units in this building (only owners may vote — Tht. §38).
    const ownerUnits = await prisma.unitUser.findMany({
      where: { userId, relationship: "OWNER", unit: { buildingId } },
      select: { unitId: true },
    });

    if (ownerUnits.length === 0) {
      // Tenant/observer — present but no votable unit. Not an error.
      return NextResponse.json({ checkedInUnitIds: [] });
    }

    await prisma.$transaction(
      ownerUnits.map((u) =>
        prisma.meetingAttendance.upsert({
          where: { meetingId_unitId: { meetingId, unitId: u.unitId } },
          update: { checkedIn: true, checkedInAt: new Date(), checkedOutAt: null },
          create: { meetingId, unitId: u.unitId, checkedIn: true },
        }),
      ),
    );

    return NextResponse.json({ checkedInUnitIds: ownerUnits.map((u) => u.unitId) });
  } catch (error) {
    console.error("Failed to self check-in:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
