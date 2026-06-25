import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/communication/mention-suggestions?channelId=…&q=…
 *
 * Returns up to 8 channel members whose first name starts with `q`.
 * Used by the composer's @-autocomplete picker.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const channelId = searchParams.get("channelId");
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    if (!channelId) {
      return NextResponse.json({ error: "channelId required" }, { status: 400 });
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { buildingId: true },
    });
    if (!channel || channel.buildingId !== buildingId) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const members = await prisma.channelMember.findMany({
      where: { channelId, userId: { not: userId } },
      include: { user: { select: { id: true, name: true } } },
    });

    const filtered = members.filter((m) => {
      if (!q) return true;
      const first = (m.user.name.split(" ")[0] ?? "").toLowerCase();
      return first.startsWith(q);
    });

    const items = filtered.slice(0, 8).map((m) => ({
      id: m.userId,
      name: m.user.name,
      firstName: m.user.name.split(" ")[0] ?? m.user.name,
      initials: m.user.name
        .split(/\s+/)
        .map((p) => p[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Mention suggestions failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
