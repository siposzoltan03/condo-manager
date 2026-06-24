import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import {
  getSubscriptionForBuilding,
  LEGACY_FEATURE_SLUG,
} from "@/lib/feature-gate";
import { getActiveFeatures } from "@/lib/feature-access";

/** Legacy module slugs (used by the sidebar nav) whose taxonomy slug is
 *  effectively active for the building — i.e. the new resolver's view,
 *  expressed in the slugs the client already understands. */
async function activeLegacySlugs(buildingId: string): Promise<string[]> {
  const active = await getActiveFeatures(buildingId);
  return Object.entries(LEGACY_FEATURE_SLUG)
    .filter(([, slug]) => active.has(slug))
    .map(([legacy]) => legacy);
}

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

    // Feature list reflects the live resolver (plan matrix + global flags +
    // per-building overrides + dependency cascade), mapped to the legacy
    // slugs the sidebar nav uses.
    const features = await activeLegacySlugs(buildingId);

    return NextResponse.json({
      id: subscription.id,
      planSlug: subscription.plan.slug,
      planName: subscription.plan.name,
      features,
      maxBuildings: subscription.plan.maxBuildings,
      maxUnitsPerBuilding: subscription.plan.maxUnitsPerBuilding,
      priceMonthly: subscription.plan.priceMonthly,
      priceYearly: subscription.plan.priceYearly,
      subscriptionStatus: subscription.subscriptionStatus,
      trialEndsAt: subscription.trialEndsAt,
      hasStripe: !!subscription.stripeCustomerId,
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
