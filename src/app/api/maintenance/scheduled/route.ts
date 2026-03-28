import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { buildingId } = await requireBuildingContext();

    // Scheduled maintenance is visible to all authenticated users
    const items = await prisma.scheduledMaintenance.findMany({
      where: { buildingId },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ scheduled: items });
  } catch (error) {
    console.error("Failed to fetch scheduled maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, date, isRecurring, recurrenceRule } = body;

    if (!title || !date) {
      return NextResponse.json(
        { error: "Missing required fields: title, date" },
        { status: 400 }
      );
    }

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

    const item = await prisma.scheduledMaintenance.create({
      data: {
        title,
        description: description ?? null,
        date: parsedDate,
        isRecurring: isRecurring ?? false,
        recurrenceRule: recurrenceRule ?? null,
        buildingId,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create scheduled maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
