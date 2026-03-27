import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { title, description, date, isRecurring, recurrenceRule } = body;

    const existing = await prisma.scheduledMaintenance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Scheduled maintenance not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) {
      const parsedDate = new Date(date);
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.scheduledMaintenance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Scheduled maintenance not found" }, { status: 404 });
    }

    await prisma.scheduledMaintenance.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete scheduled maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
