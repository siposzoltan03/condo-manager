import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

/**
 * Mark the channel as read for the current user.
 *
 * Two effects:
 *   1. Move ChannelMember.lastReadMessageId to the channel's latest message
 *      (drives the sidebar unread count).
 *   2. Bulk-create MessageRead rows for every POST in the channel that the
 *      user hasn't already read (drives the "X / Y read" feed footer).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    const { channelId } = await context.params;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, buildingId: true, isPrivate: true },
    });
    if (!channel || channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (channel.isPrivate) {
      const m = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { id: true },
      });
      if (!m) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const latest = await prisma.channelMessage.findFirst({
      where: { channelId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest) return NextResponse.json({ ok: true });

    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: { lastReadMessageId: latest.id },
      create: { channelId, userId, lastReadMessageId: latest.id },
    });

    // Read receipts for POSTs (announcement-style read tracking).
    const posts = await prisma.channelMessage.findMany({
      where: { channelId, kind: "POST", deletedAt: null },
      select: { id: true },
    });
    if (posts.length > 0) {
      await prisma.messageRead.createMany({
        data: posts.map((p) => ({ messageId: p.id, userId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark channel as read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
