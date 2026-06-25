import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { FEATURE_DEPENDENCIES, type Feature } from "@/lib/features";
import {
  requireSuperAdmin,
  adminErrorResponse,
  auditFeatureChange,
} from "@/lib/admin-feature-guard";

const BodySchema = z.object({
  featureId: z.string().min(1),
  enabled: z.boolean(),
});

/** All prerequisites of a slug, transitively. */
function transitiveDeps(slug: Feature): Feature[] {
  const out: Feature[] = [];
  const visit = (s: Feature) => {
    for (const d of FEATURE_DEPENDENCIES[s] ?? []) {
      if (!out.includes(d)) {
        out.push(d);
        visit(d);
      }
    }
  };
  visit(slug);
  return out;
}

/**
 * POST /api/admin/plans/[id]/features — toggle one feature for a plan.
 * Enforces the dependency invariant: enabling auto-enables prerequisites;
 * disabling is rejected (409) while an enabled feature still depends on it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, buildingId } = await requireSuperAdmin();
    const { id: planId } = await params;
    const { featureId, enabled } = BodySchema.parse(await request.json());

    const [plan, feature] = await Promise.all([
      prisma.plan.findUnique({ where: { id: planId } }),
      prisma.feature.findUnique({ where: { id: featureId } }),
    ]);
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (!feature) return NextResponse.json({ error: "Feature not found" }, { status: 404 });

    const slug = feature.slug as Feature;
    const allFeatures = await prisma.feature.findMany({
      select: { id: true, slug: true },
    });
    const idBySlug = new Map(allFeatures.map((f) => [f.slug, f.id]));
    const slugById = new Map(allFeatures.map((f) => [f.id, f.slug]));
    const enabledFeatureIds = new Set(
      (
        await prisma.planFeature.findMany({
          where: { planId, enabled: true },
          select: { featureId: true },
        })
      ).map((pf) => pf.featureId)
    );

    if (!enabled) {
      // Block if an enabled feature in this plan depends on `slug`.
      const blockers = [...enabledFeatureIds]
        .map((fid) => slugById.get(fid))
        .filter((s): s is string => Boolean(s))
        .filter((s) => (FEATURE_DEPENDENCIES[s as Feature] ?? []).includes(slug));
      if (blockers.length > 0) {
        return NextResponse.json(
          { error: "dependency-blocked", blocker: blockers[0] },
          { status: 409 }
        );
      }
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId, featureId } },
        update: { enabled: false },
        create: { planId, featureId, enabled: false },
      });
    } else {
      // Enable this + all transitive prerequisites.
      const toEnable = [slug, ...transitiveDeps(slug)];
      for (const s of toEnable) {
        const fid = idBySlug.get(s);
        if (!fid) continue;
        await prisma.planFeature.upsert({
          where: { planId_featureId: { planId, featureId: fid } },
          update: { enabled: true },
          create: { planId, featureId: fid, enabled: true },
        });
      }
    }

    await auditFeatureChange({
      userId,
      buildingId,
      action: "plan.feature.toggle",
      entityType: "Plan",
      entityId: planId,
      newValue: { featureSlug: slug, enabled },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: error.issues }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
