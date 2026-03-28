import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RsvpStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const rsvp = await prisma.meetingRsvp.upsert({
      where: {
        meetingId_userId: { meetingId, userId: user.id },
      },
      update: { status: status as RsvpStatus },
      create: {
        meetingId,
        userId: user.id,
        status: status as RsvpStatus,
      },
    });

    return NextResponse.json(rsvp);
  } catch (error) {
    console.error("Failed to set RSVP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
