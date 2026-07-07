import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEGACY_FEATURE_SLUG } from "@/lib/feature-gate";

/**
 * GET /api/plans — public pricing data. The per-plan `features` list (the
 * legacy marketing slugs the pricing page renders) is derived from the DB
 * PlanFeature matrix, not the retired `Plan.features` column: for each legacy
 * slug we check whether the plan enables its taxonomy feature.
 */
export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        slug: { not: "legacy" },
      },
      orderBy: { priceMonthly: "asc" },
      select: {
        name: true,
        slug: true,
        priceMonthly: true,
        priceYearly: true,
        maxBuildings: true,
        maxUnitsPerBuilding: true,
        trialDays: true,
        planFeatures: {
          where: { enabled: true },
          select: { feature: { select: { slug: true } } },
        },
      },
    });

    const legacyEntries = Object.entries(LEGACY_FEATURE_SLUG);

    const serialized = plans.map((plan) => {
      const enabled = new Set(plan.planFeatures.map((pf) => pf.feature.slug));
      const features = legacyEntries
        .filter(([, taxonomySlug]) => enabled.has(taxonomySlug))
        .map(([legacySlug]) => legacySlug);
      return {
        name: plan.name,
        slug: plan.slug,
        priceMonthly: Number(plan.priceMonthly),
        priceYearly: Number(plan.priceYearly),
        maxBuildings: plan.maxBuildings,
        maxUnitsPerBuilding: plan.maxUnitsPerBuilding,
        trialDays: plan.trialDays,
        features,
      };
    });

    return NextResponse.json(serialized, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}
