import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishToBuilding } from "@/lib/communication-bus";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

interface ReactBody {
  emoji: string;
}

const ALLOWED_EMOJI = new Set(["👍", "❤️", "😂", "🎉", "🤔", "👀"]);

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    const limited = await rateLimitMutationOrRespond(userId, "react", {
      limit: 60,
      windowSeconds: 60,
    });
    if (limited) return limited;
    const { messageId } = await context.params;

    const { emoji } = (await request.json()) as ReactBody;
    if (!emoji || !ALLOWED_EMOJI.has(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    const message = await prisma.channelMessage.findUnique({
      where: { id: messageId },
      include: {
        channel: { select: { buildingId: true, isPrivate: true, id: true } },
      },
    });
    if (!message || message.channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (message.channel.isPrivate) {
      const m = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: message.channel.id, userId } },
        select: { id: true },
      });
      if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (existing && existing.emoji === emoji) {
      // Click same emoji → remove.
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      publishToBuilding(buildingId, {
        type: "message:update",
        buildingId,
        channelId: message.channel.id,
        messageId,
        reason: "react",
      });
      return NextResponse.json({ ok: true, action: "removed" });
    }

    await prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji },
    });

    publishToBuilding(buildingId, {
      type: "message:update",
      buildingId,
      channelId: message.channel.id,
      messageId,
      reason: "react",
    });

    return NextResponse.json({ ok: true, action: "set" });
  } catch (error) {
    console.error("Failed to react:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
