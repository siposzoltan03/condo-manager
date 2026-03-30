import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { getSubscriptionForBuilding } from "@/lib/feature-gate";

/**
 * GET /api/subscription
 * Returns the current building's subscription with plan details.
 */
export async function GET() {
  try {
    const { buildingId } = await requireBuildingContext();

    const subscription = await getSubscriptionForBuilding(buildingId);

    if (!subscription) {
      // Legacy building without subscription — return all features enabled
      return NextResponse.json({
        planSlug: "legacy",
        planName: "Legacy",
        features: [
          "complaints", "announcements", "messaging", "documents",
          "finance", "voting", "maintenance", "forum",
          "api_access", "custom_branding", "audit_exports",
        ],
        maxBuildings: -1,
        maxUnitsPerBuilding: -1,
        subscriptionStatus: "ACTIVE",
        trialEndsAt: null,
        isLegacy: true,
      });
    }

    const featuresRaw = subscription.plan.features;
    const features: string[] = Array.isArray(featuresRaw)
      ? (featuresRaw as string[])
      : typeof featuresRaw === "string"
        ? JSON.parse(featuresRaw)
        : [];

    return NextResponse.json({
      planSlug: subscription.plan.slug,
      planName: subscription.plan.name,
      features,
      maxBuildings: subscription.plan.maxBuildings,
      maxUnitsPerBuilding: subscription.plan.maxUnitsPerBuilding,
      subscriptionStatus: subscription.subscriptionStatus,
      trialEndsAt: subscription.trialEndsAt,
      isLegacy: false,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
