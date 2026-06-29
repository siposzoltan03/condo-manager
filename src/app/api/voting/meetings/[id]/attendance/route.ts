import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { calculateMeetingQuorum } from "@/lib/voting/quorum";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/voting/meetings/[id]/attendance
 * List all attendance records for a meeting + quorum info.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { buildingId } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id: meetingId } = await context.params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const [attendances, units, quorum] = await Promise.all([
      prisma.meetingAttendance.findMany({
        where: { meetingId },
        include: {
          unit: {
            select: {
              id: true,
              number: true,
              ownershipShare: true,
              unitUsers: {
                where: { relationship: "OWNER" },
                include: { user: { select: { id: true, name: true } } },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.unit.findMany({
        where: { buildingId },
        select: {
          id: true,
          number: true,
          ownershipShare: true,
          unitUsers: {
            where: { relationship: "OWNER" },
            include: { user: { select: { id: true, name: true } } },
            take: 1,
          },
        },
        orderBy: { number: "asc" },
      }),
      calculateMeetingQuorum(meetingId),
    ]);

    const checkedInUnitIds = new Set(
      attendances.filter((a) => a.checkedIn && !a.checkedOutAt).map((a) => a.unitId)
    );

    const unitList = units.map((unit) => ({
      unitId: unit.id,
      unitNumber: unit.number,
      ownershipShare: Number(unit.ownershipShare),
      ownerName: unit.unitUsers[0]?.user.name ?? null,
      ownerId: unit.unitUsers[0]?.user.id ?? null,
      checkedIn: checkedInUnitIds.has(unit.id),
    }));

    return NextResponse.json({
      units: unitList,
      quorum,
      isRepeated: meeting.isRepeated,
    });
  } catch (error) {
    console.error("Failed to get attendance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/voting/meetings/[id]/attendance
 * Check in a unit. Board member only. Idempotent (upsert).
 * Body: { unitId: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!allows(ctx, "vote.start")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: meetingId } = await context.params;
    const body = await request.json();
    const { unitId } = body;

    if (!unitId) {
      return NextResponse.json({ error: "unitId is required" }, { status: 400 });
    }

    const [meeting, unit] = await Promise.all([
      prisma.meeting.findUnique({ where: { id: meetingId } }),
      prisma.unit.findUnique({ where: { id: unitId } }),
    ]);

    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!unit || unit.buildingId !== buildingId) {
      return NextResponse.json({ error: "Unit not found in this building" }, { status: 404 });
    }

    const attendance = await prisma.meetingAttendance.upsert({
      where: {
        meetingId_unitId: { meetingId, unitId },
      },
      update: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedOutAt: null,
      },
      create: {
        meetingId,
        unitId,
        checkedIn: true,
      },
    });

    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    console.error("Failed to check in:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/voting/meetings/[id]/attendance
 * Check out a unit. Board member only.
 * Body: { unitId: string }
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!allows(ctx, "vote.start")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: meetingId } = await context.params;
    const body = await request.json();
    const { unitId } = body;

    if (!unitId) {
      return NextResponse.json({ error: "unitId is required" }, { status: 400 });
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const existing = await prisma.meetingAttendance.findUnique({
      where: { meetingId_unitId: { meetingId, unitId } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit is not checked in" }, { status: 404 });
    }

    const attendance = await prisma.meetingAttendance.update({
      where: { id: existing.id },
      data: {
        checkedIn: false,
        checkedOutAt: new Date(),
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Failed to check out:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
