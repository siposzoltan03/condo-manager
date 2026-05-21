import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishToBuilding } from "@/lib/communication-bus";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    const limited = await rateLimitMutationOrRespond(userId, "typing", {
      // 1 ping every 2s = 30/min ceiling; allow some bursts
      limit: 60,
      windowSeconds: 60,
    });
    if (limited) return limited;
    const { channelId } = await context.params;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { buildingId: true, isPrivate: true },
    });
    if (!channel || channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    if (channel.isPrivate) {
      const m = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { id: true },
      });
      if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user) return NextResponse.json({ ok: true });

    publishToBuilding(buildingId, {
      type: "typing",
      buildingId,
      channelId,
      userId,
      userFirstName: user.name.split(" ")[0] ?? user.name,
      at: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to publish typing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
