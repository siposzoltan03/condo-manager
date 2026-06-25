import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishToBuilding } from "@/lib/communication-bus";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

interface VoteBody {
  optionId: string;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    const { messageId } = await context.params;

    const message = await prisma.channelMessage.findUnique({
      where: { id: messageId },
      include: {
        channel: { select: { buildingId: true, isPrivate: true, id: true } },
        poll: { include: { options: { select: { id: true } } } },
      },
    });
    if (!message || message.channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (!message.poll) {
      return NextResponse.json({ error: "Not a poll" }, { status: 400 });
    }

    if (message.channel.isPrivate) {
      const m = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: message.channel.id, userId } },
        select: { id: true },
      });
      if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (message.poll.closedAt) {
      return NextResponse.json({ error: "Poll closed" }, { status: 400 });
    }
    if (message.poll.closesAt && message.poll.closesAt < new Date()) {
      return NextResponse.json({ error: "Poll closed" }, { status: 400 });
    }

    const { optionId } = (await request.json()) as VoteBody;
    if (!message.poll.options.some((o) => o.id === optionId)) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }

    const existing = await prisma.pollVote.findUnique({
      where: {
        pollId_optionId_userId: {
          pollId: message.poll.id,
          optionId,
          userId,
        },
      },
    });

    if (existing) {
      // Toggle off.
      await prisma.pollVote.delete({ where: { id: existing.id } });
      publishToBuilding(buildingId, {
        type: "message:update",
        buildingId,
        channelId: message.channel.id,
        messageId,
        reason: "vote",
      });
      return NextResponse.json({ ok: true, action: "removed" });
    }

    if (!message.poll.allowMultiple) {
      // Remove any existing vote in this poll first.
      await prisma.pollVote.deleteMany({
        where: { pollId: message.poll.id, userId },
      });
    }

    await prisma.pollVote.create({
      data: { pollId: message.poll.id, optionId, userId },
    });

    publishToBuilding(buildingId, {
      type: "message:update",
      buildingId,
      channelId: message.channel.id,
      messageId,
      reason: "vote",
    });

    return NextResponse.json({ ok: true, action: "added" });
  } catch (error) {
    console.error("Failed to vote on poll:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
