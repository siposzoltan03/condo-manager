import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
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

    await createAuditLog({
      entityType: "Meeting",
      entityId: meetingId,
      action: "UPDATE",
      userId,
      newValue: { minutesUpdated: true },
    });

    return NextResponse.json({ id: updated.id, hasMinutes: true });
  } catch (error) {
    console.error("Failed to upload minutes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
