import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "maintenance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { title, description, date, isRecurring, recurrenceRule } = body;

    const existing = await prisma.scheduledMaintenance.findUnique({ where: { id } });
    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Scheduled maintenance not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) {
      const dateParts = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateParts) {
        return NextResponse.json({ error: "Invalid date format, expected YYYY-MM-DD" }, { status: 400 });
      }
      const parsedDate = new Date(Date.UTC(
        parseInt(dateParts[1], 10),
        parseInt(dateParts[2], 10) - 1,
        parseInt(dateParts[3], 10)
      ));
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      updateData.date = parsedDate;
    }
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule;

    const updated = await prisma.scheduledMaintenance.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update scheduled maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "maintenance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.scheduledMaintenance.findUnique({ where: { id } });
    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Scheduled maintenance not found" }, { status: 404 });
    }

    await prisma.scheduledMaintenance.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete scheduled maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
