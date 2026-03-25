import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify announcement exists
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Upsert read record (idempotent)
    await prisma.announcementRead.upsert({
      where: {
        userId_announcementId: {
          userId: user.id,
          announcementId: id,
        },
      },
      create: {
        userId: user.id,
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
