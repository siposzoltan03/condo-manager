import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { calculateMeetingQuorum } from "@/lib/voting/quorum";
import { meetingUpdated, meetingDeleted } from "@/lib/voting/events";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id } = await context.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        rsvps: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        votes: {
          select: { id: true, title: true, status: true, deadline: true },
        },
      },
    });

    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const quorum = await calculateMeetingQuorum(id);

    return NextResponse.json({
      ...meeting,
      quorum,
    });
  } catch (error) {
    console.error("Failed to fetch meeting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.date !== undefined) data.date = new Date(body.date);
    if (body.time !== undefined) data.time = body.time;
    if (body.location !== undefined) data.location = body.location;
    if (body.agenda !== undefined) data.agenda = body.agenda;
    if (body.isRepeated !== undefined) data.isRepeated = body.isRepeated;

    const updated = await prisma.meeting.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await meetingUpdated({
      meetingId: id,
      updatedByUserId: userId,
      buildingId,
      oldValue: { title: existing.title, date: existing.date.toISOString() },
      newValue: data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update meeting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await prisma.meeting.delete({ where: { id } });

    await meetingDeleted({
      meetingId: id,
      deletedByUserId: userId,
      buildingId,
      oldValue: { title: existing.title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete meeting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
