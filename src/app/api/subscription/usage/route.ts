import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { getSubscriptionForBuilding } from "@/lib/feature-gate";
import { checkBuildingLimit, checkUnitLimit } from "@/lib/plan-limits";

/**
 * GET /api/subscription/usage
 * Returns building count vs max and unit count vs max for the current building.
 */
export async function GET() {
  try {
    const { buildingId } = await requireBuildingContext();

    const subscription = await getSubscriptionForBuilding(buildingId);

    if (!subscription) {
      // Legacy building — unlimited
      return NextResponse.json({
        buildings: { current: 0, max: -1 },
        units: { current: 0, max: -1 },
      });
    }

    const [buildings, units] = await Promise.all([
      checkBuildingLimit(subscription.id),
      checkUnitLimit(buildingId),
    ]);

    return NextResponse.json({ buildings, units });
  } catch (error) {
    console.error("Failed to fetch subscription usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
