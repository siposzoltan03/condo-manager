import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scheduled maintenance is visible to all authenticated users
    const items = await prisma.scheduledMaintenance.findMany({
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
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

    const parsedDate = new Date(date);
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
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create scheduled maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
