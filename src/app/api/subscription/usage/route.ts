import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { getSubscriptionForBuilding } from "@/lib/feature-gate";
import { checkBuildingLimit, checkUnitLimit } from "@/lib/plan-limits";
import { getFrozenBuildings } from "@/lib/frozen-check";

/**
 * GET /api/subscription/usage
 * Returns building count vs max, unit count vs max, and frozen building info.
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
        frozenBuildings: [],
      });
    }

    const [buildings, units, frozenBuildings] = await Promise.all([
      checkBuildingLimit(subscription.id),
      checkUnitLimit(buildingId),
      getFrozenBuildings(subscription.id),
    ]);

    return NextResponse.json({ buildings, units, frozenBuildings });
  } catch (error) {
    console.error("Failed to fetch subscription usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
