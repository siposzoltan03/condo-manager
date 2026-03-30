import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";
import { RsvpStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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
    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(RsvpStatus).includes(status as RsvpStatus)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ATTENDING, NOT_ATTENDING, or PROXY" },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const rsvp = await prisma.meetingRsvp.upsert({
      where: {
        meetingId_userId: { meetingId, userId },
      },
      update: { status: status as RsvpStatus },
      create: {
        meetingId,
        userId,
        status: status as RsvpStatus,
      },
    });

    return NextResponse.json(rsvp);
  } catch (error) {
    console.error("Failed to set RSVP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
