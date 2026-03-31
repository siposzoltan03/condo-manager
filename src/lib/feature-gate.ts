import { prisma } from "./prisma";

/**
 * In-request cache for plan data per building to avoid repeated DB queries.
 */
const planCache = new Map<
  string,
  { features: string[]; maxBuildings: number; maxUnitsPerBuilding: number } | null
>();

/**
 * Custom error class thrown when a feature is not available on the current plan.
 */
export class FeatureGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureGateError";
  }
}

/**
 * Mapping of feature slugs to the minimum plan that includes them.
 * Used by the UI to show plan badges on gated sidebar items.
 */
const FEATURE_PLAN_MAP: Record<string, string> = {
  complaints: "starter",
  announcements: "starter",
  messaging: "starter",
  documents: "starter",
  finance: "pro",
  voting: "pro",
  maintenance: "pro",
  forum: "pro",
  api_access: "enterprise",
  custom_branding: "enterprise",
  audit_exports: "enterprise",
};

/**
 * Returns the minimum plan slug required for a given feature.
 * Returns "starter" if the feature is unknown.
 */
export function featureToMinimumPlan(featureSlug: string): string {
  return FEATURE_PLAN_MAP[featureSlug] ?? "starter";
}

/**
 * Loads the subscription and plan for a building, with in-request caching.
 * Returns null if no active subscription exists.
 * Buildings without a subscription (legacy) return null — callers should
 * treat null as "allow all" for backwards compatibility.
 */
export async function getPlanForBuilding(buildingId: string) {
  if (planCache.has(buildingId)) return planCache.get(buildingId)!;

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { subscription: { include: { plan: true } } },
  });

  if (!building?.subscription?.plan) {
    planCache.set(buildingId, null);
    return null;
  }

  const sub = building.subscription;

  // Check subscription status — only TRIALING and ACTIVE are considered valid
  const isActive = ["TRIALING", "ACTIVE"].includes(sub.subscriptionStatus);
  if (!isActive) {
    planCache.set(buildingId, null);
    return null;
  }

  // Check trial expiry
  if (
    sub.subscriptionStatus === "TRIALING" &&
    sub.trialEndsAt &&
    new Date() > sub.trialEndsAt
  ) {
    planCache.set(buildingId, null);
    return null;
  }

  const featuresRaw = sub.plan.features;
  const features: string[] = Array.isArray(featuresRaw)
    ? (featuresRaw as string[])
    : typeof featuresRaw === "string"
      ? JSON.parse(featuresRaw)
      : [];

  const data = {
    features,
    maxBuildings: sub.plan.maxBuildings,
    maxUnitsPerBuilding: sub.plan.maxUnitsPerBuilding,
  };
  planCache.set(buildingId, data);
  return data;
}

/**
 * Loads the full subscription record for a building, including plan details.
 * Unlike getPlanForBuilding, this returns the raw subscription object
 * for cases where callers need subscription-level data (e.g., subscriptionId).
 */
export async function getSubscriptionForBuilding(buildingId: string) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { subscription: { include: { plan: true } } },
  });

  return building?.subscription ?? null;
}

/**
 * Asserts that the given feature is available for the building's plan.
 * Throws FeatureGateError if the feature is not included.
 *
 * Buildings without a subscription (legacy) are allowed through for
 * backwards compatibility.
 */
export async function requireFeature(
  buildingId: string,
  featureSlug: string
): Promise<void> {
  const plan = await getPlanForBuilding(buildingId);

  // Legacy buildings without subscription — allow through
  if (!plan) {
    // Check if building actually has no subscription (legacy) vs expired
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { subscriptionId: true },
    });
    if (!building?.subscriptionId) {
      // No subscription at all — legacy building, allow all features
      return;
    }
    // Has subscription but it's not active/trialing — block
    throw new FeatureGateError("No active subscription");
  }

  if (!plan.features.includes(featureSlug)) {
    throw new FeatureGateError(
      `Feature "${featureSlug}" requires a plan upgrade`
    );
  }
}
