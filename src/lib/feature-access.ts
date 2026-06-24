import "server-only";
import { prisma } from "./prisma";
import { isFeature, type Feature } from "./features";
import {
  resolveFeature,
  applyDependencies,
  type FeatureFlagState,
} from "./feature-resolver";

/**
 * DB-backed feature resolution + read DAL for the superadmin console.
 *
 * Additive: this does NOT replace the legacy `requireFeature` in
 * feature-gate.ts (which still gates with the old slugs). Migrating
 * enforcement to this taxonomy belongs with the gating-enforcement plan.
 *
 * Plan: docs/plans/2026-06-23-superadmin-feature-management.md (Phase 2).
 */

type ResolutionInputs = {
  /** plan whose PlanFeature rows to resolve against (trial rule applied), or null */
  planId: string | null;
  flagByFeatureId: Map<string, FeatureFlagState>;
  planEnabledByFeatureId: Map<string, boolean>;
  overrideByFeatureId: Map<string, boolean>; // grant true/false, expired filtered out
  features: { id: string; slug: string }[];
};

function source(
  flagState: FeatureFlagState,
  override: boolean | null
): "kill" | "override" | "force" | "plan" {
  if (flagState === "KILL_SWITCH") return "kill";
  if (override !== null) return "override";
  if (flagState === "FORCE_ON") return "force";
  return "plan";
}

/** Loads everything the resolver needs for one building. */
async function loadInputs(buildingId: string): Promise<ResolutionInputs> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { subscription: { include: { plan: true } } },
  });

  // Resolve the plan to use (trial rule: TRIALING resolves against `pro`).
  let planId: string | null = null;
  const sub = building?.subscription;
  if (sub && ["TRIALING", "ACTIVE"].includes(sub.subscriptionStatus)) {
    const trialExpired =
      sub.subscriptionStatus === "TRIALING" &&
      sub.trialEndsAt != null &&
      new Date() > sub.trialEndsAt;
    if (!trialExpired) {
      if (sub.subscriptionStatus === "TRIALING") {
        const pro = await prisma.plan.findUnique({ where: { slug: "pro" } });
        planId = pro?.id ?? sub.planId;
      } else {
        planId = sub.planId;
      }
    }
  }

  const [features, planFeatures, flags, overrides] = await Promise.all([
    prisma.feature.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    }),
    planId
      ? prisma.planFeature.findMany({ where: { planId } })
      : Promise.resolve([]),
    prisma.featureFlag.findMany(),
    prisma.buildingFeatureOverride.findMany({
      where: {
        buildingId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
  ]);

  return {
    planId,
    features,
    planEnabledByFeatureId: new Map(
      planFeatures.map((pf) => [pf.featureId, pf.enabled])
    ),
    flagByFeatureId: new Map(flags.map((f) => [f.featureId, f.state])),
    overrideByFeatureId: new Map(overrides.map((o) => [o.featureId, o.grant])),
  };
}

/**
 * The set of features effectively available to a building, after precedence
 * (kill > override > force > plan) and the dependency cascade.
 *
 * Intentionally uncached: it's hit on every gated request, but the inputs are
 * a few indexed queries. (An earlier `unstable_cache` + `revalidateTag` layer
 * was removed — that combo is unreliable in dev and produced intermittently
 * stale gating. Prod-grade caching can be revisited with a verifiable setup.)
 */
export async function getActiveFeatures(
  buildingId: string
): Promise<Set<Feature>> {
  const inp = await loadInputs(buildingId);
  const raw = new Set<Feature>();
  for (const f of inp.features) {
    if (!isFeature(f.slug)) continue;
    const flagState = inp.flagByFeatureId.get(f.id) ?? "PER_PLAN";
    const override = inp.overrideByFeatureId.has(f.id)
      ? inp.overrideByFeatureId.get(f.id)!
      : null;
    const planEnabled = inp.planEnabledByFeatureId.get(f.id) ?? false;
    if (resolveFeature({ planEnabled, flagState, override })) raw.add(f.slug);
  }
  return applyDependencies(raw);
}

// ── Console read DAL ─────────────────────────────────────────────────────────

export type CatalogFeature = {
  id: string;
  slug: string;
  module: string;
  name: string;
  description: string | null;
  isActive: boolean;
  flagState: FeatureFlagState;
  /** plan slug → included by default */
  plans: Record<string, boolean>;
};

/** Screen 1 — feature catalog + global flags + which plans include each. */
export async function getFeatureCatalog(): Promise<CatalogFeature[]> {
  const [features, flags, plans, planFeatures] = await Promise.all([
    prisma.feature.findMany({ orderBy: [{ module: "asc" }, { sortOrder: "asc" }] }),
    prisma.featureFlag.findMany(),
    prisma.plan.findMany({ select: { id: true, slug: true } }),
    prisma.planFeature.findMany(),
  ]);
  const flagByFeature = new Map(flags.map((f) => [f.featureId, f.state]));
  const planSlugById = new Map(plans.map((p) => [p.id, p.slug]));
  const enabledByFeature = new Map<string, Record<string, boolean>>();
  for (const pf of planFeatures) {
    const slug = planSlugById.get(pf.planId);
    if (!slug) continue;
    const rec = enabledByFeature.get(pf.featureId) ?? {};
    rec[slug] = pf.enabled;
    enabledByFeature.set(pf.featureId, rec);
  }
  return features.map((f) => ({
    id: f.id,
    slug: f.slug,
    module: f.module,
    name: f.name,
    description: f.description,
    isActive: f.isActive,
    flagState: flagByFeature.get(f.id) ?? "PER_PLAN",
    plans: enabledByFeature.get(f.id) ?? {},
  }));
}

export type PlanMatrix = {
  plans: {
    id: string;
    slug: string;
    name: string;
    maxBuildings: number;
    maxUnitsPerBuilding: number;
    priceMonthly: string;
    priceYearly: string;
    trialDays: number;
    isActive: boolean;
    stripePriceId: string | null;
    activeSubscriptions: number;
  }[];
  features: { id: string; slug: string; module: string; name: string }[];
  /** `${planId}:${featureId}` → enabled */
  enabled: Record<string, boolean>;
};

/** Screen 2 — plan editor matrix + limits/pricing. */
export async function getPlanMatrix(): Promise<PlanMatrix> {
  const [plans, features, planFeatures] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.feature.findMany({
      where: { isActive: true },
      orderBy: [{ module: "asc" }, { sortOrder: "asc" }],
      select: { id: true, slug: true, module: true, name: true },
    }),
    prisma.planFeature.findMany(),
  ]);
  const enabled: Record<string, boolean> = {};
  for (const pf of planFeatures) enabled[`${pf.planId}:${pf.featureId}`] = pf.enabled;
  return {
    plans: plans.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      maxBuildings: p.maxBuildings,
      maxUnitsPerBuilding: p.maxUnitsPerBuilding,
      priceMonthly: p.priceMonthly.toString(),
      priceYearly: p.priceYearly.toString(),
      trialDays: p.trialDays,
      isActive: p.isActive,
      stripePriceId: p.stripePriceId,
      activeSubscriptions: p._count.subscriptions,
    })),
    features,
    enabled,
  };
}

export type OverrideViewRow = {
  id: string;
  slug: string;
  module: string;
  name: string;
  source: "kill" | "override" | "force" | "plan";
  available: boolean;
  /** raw-available but removed by the dependency cascade */
  cascade: boolean;
  override: { grant: boolean; reason: string | null; expiresAt: string | null } | null;
};

export type BuildingOverrideView = {
  building: {
    id: string;
    name: string;
    address: string;
    planSlug: string | null;
    units: number;
  };
  rows: OverrideViewRow[];
};

/** Screen 3 — per-building effective resolution + editable overrides. */
export async function getBuildingOverrideView(
  buildingId: string
): Promise<BuildingOverrideView | null> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!building) return null;

  const inp = await loadInputs(buildingId);
  const overrideRows = await prisma.buildingFeatureOverride.findMany({
    where: { buildingId },
  });
  const overrideRowByFeatureId = new Map(overrideRows.map((o) => [o.featureId, o]));

  const features = await prisma.feature.findMany({
    where: { isActive: true },
    orderBy: [{ module: "asc" }, { sortOrder: "asc" }],
  });

  // raw availability + cascade
  const raw = new Set<Feature>();
  for (const f of features) {
    if (!isFeature(f.slug)) continue;
    const flagState = inp.flagByFeatureId.get(f.id) ?? "PER_PLAN";
    const override = inp.overrideByFeatureId.has(f.id)
      ? inp.overrideByFeatureId.get(f.id)!
      : null;
    const planEnabled = inp.planEnabledByFeatureId.get(f.id) ?? false;
    if (resolveFeature({ planEnabled, flagState, override })) raw.add(f.slug);
  }
  const effective = applyDependencies(new Set(raw));

  const rows: OverrideViewRow[] = features
    .filter((f) => isFeature(f.slug))
    .map((f) => {
      const flagState = inp.flagByFeatureId.get(f.id) ?? "PER_PLAN";
      const liveOverride = inp.overrideByFeatureId.has(f.id)
        ? inp.overrideByFeatureId.get(f.id)!
        : null;
      const rawAvail = raw.has(f.slug as Feature);
      const effAvail = effective.has(f.slug as Feature);
      const ovRow = overrideRowByFeatureId.get(f.id);
      return {
        id: f.id,
        slug: f.slug,
        module: f.module,
        name: f.name,
        source: source(flagState, liveOverride),
        available: effAvail,
        cascade: rawAvail && !effAvail,
        override: ovRow
          ? {
              grant: ovRow.grant,
              reason: ovRow.reason,
              expiresAt: ovRow.expiresAt ? ovRow.expiresAt.toISOString() : null,
            }
          : null,
      };
    });

  return {
    building: {
      id: building.id,
      name: building.name,
      address: building.address,
      planSlug: building.subscription?.plan?.slug ?? null,
      units: building.totalUnits,
    },
    rows,
  };
}
