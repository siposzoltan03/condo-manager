import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight list of meetings (future + last 7 days) used by the complaint
 * escalation picker.
 */
export async function GET() {
  try {
    const { buildingId } = await requireBuildingContext();
    const cutoff = new Date(Date.now() - 7 * 86400_000);
    const meetings = await prisma.meeting.findMany({
      where: { buildingId, date: { gte: cutoff } },
      select: { id: true, title: true, date: true },
      orderBy: { date: "asc" },
      take: 30,
    });
    return NextResponse.json({ meetings });
  } catch (error) {
    console.error("Failed to list meetings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
