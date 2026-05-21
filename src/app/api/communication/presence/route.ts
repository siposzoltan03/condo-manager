import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { markPresent, publishToBuilding } from "@/lib/communication-bus";

/**
 * Presence heartbeat. Client pings every ~30s while the page is visible.
 * Server records last-seen and rebroadcasts so other clients flip the
 * online dot for this user.
 */
export async function POST(_request: NextRequest) {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    markPresent(userId);
    publishToBuilding(buildingId, {
      type: "presence",
      buildingId,
      userId,
      online: true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to ping presence:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
