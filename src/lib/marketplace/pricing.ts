import * as dal from "./dal";

/**
 * Pricing tiers + quota enforcement for the contractor marketplace.
 *
 * Plan caps:
 *   Free:    3 bids / 7 days  ·  1 specialty   ·  1 region
 *   Pro:     unlimited bids   ·  5 specialties · 5 regions
 *   Premium: unlimited bids   ·  unlimited     · unlimited  ·  featured ranking
 *
 * Free is a *throughput* cap (rolling 7 days) rather than a capacity
 * cap, so a contractor can keep unlimited active bids open at once.
 * Specialty + region caps are profile-level; changing on Free requires
 * removing an existing entry first.
 */

export type Plan = "FREE" | "PRO" | "PREMIUM";

export interface PlanCaps {
  bidsPer7Days: number | null;
  specialties: number | null;
  regions: number | null;
  featuredRanking: boolean;
  monthlyPriceFt: number;
  /** Stripe price id env var; resolved lazily so dev can run without Stripe. */
  stripePriceEnv: string | null;
}

const UNLIMITED = null;

export const PLAN_CAPS: Record<Plan, PlanCaps> = {
  FREE: {
    bidsPer7Days: 3,
    specialties: 1,
    regions: 1,
    featuredRanking: false,
    monthlyPriceFt: 0,
    stripePriceEnv: null,
  },
  PRO: {
    bidsPer7Days: UNLIMITED,
    specialties: 5,
    regions: 5,
    featuredRanking: false,
    monthlyPriceFt: 9900,
    stripePriceEnv: "STRIPE_PRICE_CONTRACTOR_PRO",
  },
  PREMIUM: {
    bidsPer7Days: UNLIMITED,
    specialties: UNLIMITED,
    regions: UNLIMITED,
    featuredRanking: true,
    monthlyPriceFt: 24900,
    stripePriceEnv: "STRIPE_PRICE_CONTRACTOR_PREMIUM",
  },
};

/**
 * The plan the contractor effectively gets for *gating purposes today*.
 * Trial means TRIALING orgs get the trialled plan's caps. Expired
 * trials lazy-downgrade to FREE on read so we don't need a worker job.
 */
export interface EffectivePlan {
  plan: Plan;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";
  caps: PlanCaps;
  trialEndsAt: Date | null;
  /** Days remaining in trial; null when not trialling or expired. */
  trialDaysRemaining: number | null;
}

export async function getEffectivePlan(orgId: string): Promise<EffectivePlan> {
  const org = await dal.findOrgPlanState(orgId);
  if (!org) {
    return {
      plan: "FREE",
      status: "ACTIVE",
      caps: PLAN_CAPS.FREE,
      trialEndsAt: null,
      trialDaysRemaining: null,
    };
  }

  const now = Date.now();
  let plan = org.plan as Plan;
  let status = (org.planStatus as EffectivePlan["status"]) || "ACTIVE";

  // Lazy trial-expiry: if TRIALING and trialEndsAt has passed, treat as FREE
  // until Stripe re-syncs / the user upgrades.
  if (
    status === "TRIALING" &&
    org.trialEndsAt &&
    org.trialEndsAt.getTime() < now
  ) {
    plan = "FREE";
    status = "ACTIVE";
  }

  // CANCELLED / PAST_DUE → FREE caps but keep the status so the UI can
  // show a "fix your billing" banner.
  if (status === "CANCELLED" || status === "PAST_DUE") {
    plan = "FREE";
  }

  let trialDaysRemaining: number | null = null;
  if (status === "TRIALING" && org.trialEndsAt) {
    const ms = org.trialEndsAt.getTime() - now;
    trialDaysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  return {
    plan,
    status,
    caps: PLAN_CAPS[plan],
    trialEndsAt: org.trialEndsAt,
    trialDaysRemaining,
  };
}

/**
 * Throughput check: returns true iff a *new* bid would keep the org
 * under its 7-day quota. Edits to an existing bid don't count.
 */
export async function isWithinBidThroughput(
  orgId: string,
  effective: EffectivePlan,
): Promise<boolean> {
  if (effective.caps.bidsPer7Days === null) return true;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await dal.countActiveBidsByOrgSince(orgId, since);
  return count < effective.caps.bidsPer7Days;
}

/**
 * Specialty cap check: returns true iff the requested specialty list
 * fits the plan's cap.
 */
export function isWithinSpecialtyCap(
  count: number,
  effective: EffectivePlan,
): boolean {
  if (effective.caps.specialties === null) return true;
  return count <= effective.caps.specialties;
}

export function isWithinRegionCap(
  count: number,
  effective: EffectivePlan,
): boolean {
  if (effective.caps.regions === null) return true;
  return count <= effective.caps.regions;
}

/**
 * Compute a fresh 14-day Pro trial window. Used at signup time.
 */
export function newTrialWindow(): { trialEndsAt: Date } {
  return {
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  };
}
