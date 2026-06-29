import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { publishToBuilding } from "@/lib/communication-bus";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    if (!allows(ctx, "board.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { messageId } = await context.params;

    const message = await prisma.channelMessage.findUnique({
      where: { id: messageId },
      include: { channel: { select: { id: true, buildingId: true } } },
    });
    if (!message || message.channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const updated = await prisma.channelMessage.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
      select: { id: true, isPinned: true },
    });

    publishToBuilding(buildingId, {
      type: "message:update",
      buildingId,
      channelId: message.channel.id,
      messageId,
      reason: "pin",
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to toggle pin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
