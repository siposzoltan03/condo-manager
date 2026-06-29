import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { meetingMinutesUpdated } from "@/lib/voting/events";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!allows(ctx, "vote.editMinutes")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: meetingId } = await context.params;
    const body = await request.json();
    const { minutes } = body;

    if (!minutes || typeof minutes !== "string") {
      return NextResponse.json(
        { error: "Missing required field: minutes" },
        { status: 400 }
      );
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.buildingId !== buildingId) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: { minutes },
    });

    await meetingMinutesUpdated({
      meetingId,
      updatedByUserId: userId,
      buildingId,
    });

    return NextResponse.json({ id: updated.id, hasMinutes: true });
  } catch (error) {
    console.error("Failed to upload minutes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
