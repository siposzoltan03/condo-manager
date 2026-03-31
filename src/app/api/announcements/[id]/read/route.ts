import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    const { id } = await context.params;

    // Verify announcement exists and belongs to building
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, buildingId: true },
    });

    if (!announcement || announcement.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Upsert read record (idempotent)
    await prisma.announcementRead.upsert({
      where: {
        userId_announcementId: {
          userId,
          announcementId: id,
        },
      },
      create: {
        userId,
        announcementId: id,
      },
      update: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark announcement as read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
