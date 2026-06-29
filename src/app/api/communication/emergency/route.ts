import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { publishToBuilding } from "@/lib/communication-bus";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";

interface EmergencyBody {
  title: string;
  body: string;
}

/**
 * Vészriasztás — broadcast urgent post to the building's ANNOUNCEMENT
 * channel and notify every active building member. Board+ only.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    if (!allows(ctx, "announcement.publish")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Tight: emergency broadcasts go to every resident; abuse is high-cost.
    const limited = await rateLimitMutationOrRespond(userId, "emergency:send", {
      limit: 3,
      windowSeconds: 600, // 3 per 10 min
    });
    if (limited) return limited;

    const { title, body } = (await request.json()) as EmergencyBody;
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 },
      );
    }

    const channel = await prisma.channel.findFirst({
      where: { buildingId, kind: "ANNOUNCEMENT" },
      select: { id: true },
    });
    if (!channel) {
      return NextResponse.json(
        { error: "Announcement channel missing" },
        { status: 500 },
      );
    }

    const message = await prisma.channelMessage.create({
      data: {
        channelId: channel.id,
        authorId: userId,
        kind: "POST",
        title: title.trim(),
        body: body.trim(),
        isUrgent: true,
      },
      select: { id: true },
    });

    await prisma.channel.update({
      where: { id: channel.id },
      data: { updatedAt: new Date() },
    });

    // Notify every active member of the building (except the author).
    const members = await prisma.userBuilding.findMany({
      where: { buildingId, isActive: true, userId: { not: userId } },
      select: { userId: true },
    });
    if (members.length > 0) {
      await prisma.notification.createMany({
        data: members.map((m) => ({
          userId: m.userId,
          type: "EMERGENCY",
          title: title.trim(),
          body: body.trim().slice(0, 200),
          entityType: "ChannelMessage",
          entityId: message.id,
        })),
      });
    }

    publishToBuilding(buildingId, {
      type: "message:new",
      buildingId,
      channelId: channel.id,
      messageId: message.id,
      authorId: userId,
      isUrgent: true,
    });

    return NextResponse.json(
      { id: message.id, channelId: channel.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to broadcast emergency:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
