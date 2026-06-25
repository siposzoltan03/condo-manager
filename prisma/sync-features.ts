/**
 * Idempotent sync of the code-owned feature taxonomy → DB, plus the default
 * plan↔feature matrix. Run after any change to src/lib/features.ts.
 *
 *   npm run seed:features
 *
 * - Upserts a `Feature` row per code slug (module from prefix; name/description
 *   seeded from the hu.json display strings; sortOrder = enum order).
 * - Retires (isActive=false) `Feature` rows whose slug left the code enum —
 *   never hard-deletes, so overrides/history survive.
 * - Seeds `PlanFeature.enabled` for every plan × feature.
 *
 * Plan: docs/plans/2026-06-23-superadmin-feature-management.md (Phase 1).
 * Does NOT seed FeatureFlag rows (absence = PER_PLAN) or building overrides
 * (operational data); the console manages those.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURES, featureModule, type Feature } from "../src/lib/features";

const prisma = new PrismaClient();

const hu = JSON.parse(
  readFileSync(join(process.cwd(), "src/i18n/hu.json"), "utf8")
);
const FEATURE_STRINGS = hu.featureConsole.features as Record<
  string,
  Record<string, { name: string; desc?: string }>
>;

function display(slug: Feature): { name: string; description: string | null } {
  const mod = featureModule(slug);
  const cap = slug.slice(mod.length + 1);
  const node = FEATURE_STRINGS?.[mod]?.[cap];
  return { name: node?.name ?? slug, description: node?.desc ?? null };
}

// Tier → feature sets. Mirrors the gating plan's PLAN_FEATURES, mapped onto the
// DB's current plan slugs (starter/pro/enterprise; the Hungarian tier rename is
// a separate plan). `legacy` is grandfathered to everything.
const STARTER: Feature[] = [
  "voting.basic",
  "voting.weighted",
  "finance.ledger",
  "maintenance.tickets",
  "documents.basic",
  "communication.announcements",
  "communication.forum",
  "communication.complaints",
  "audit.basic",
];
const PRO: Feature[] = [
  ...STARTER,
  "voting.proxy",
  "voting.electronic",
  "finance.budget",
  "finance.bank-csv",
  "finance.pdf-report",
  "maintenance.kanban",
  "maintenance.contractors",
  "maintenance.scheduled",
  "documents.versioning",
  "communication.messages",
  "audit.export",
  "platform.multi-building",
];
const ENTERPRISE: Feature[] = [
  ...PRO,
  "finance.bank-sync-live",
  "documents.signing",
  "platform.api",
  "platform.sso",
  "platform.custom-branding",
  "ai.minutes-summary",
  "ai.classify",
];

const PLAN_FEATURES: Record<string, Feature[]> = {
  starter: STARTER,
  pro: PRO,
  enterprise: ENTERPRISE,
  legacy: [...FEATURES], // grandfathered — everything
};

async function main() {
  // 1. Upsert Feature rows from the code enum.
  for (let i = 0; i < FEATURES.length; i++) {
    const slug = FEATURES[i];
    const { name, description } = display(slug);
    const data = {
      module: featureModule(slug),
      sortOrder: i,
      isActive: true,
      name,
      description,
    };
    await prisma.feature.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }

  // 2. Retire features whose slug left the code enum (never delete).
  const retired = await prisma.feature.updateMany({
    where: { slug: { notIn: [...FEATURES] }, isActive: true },
    data: { isActive: false },
  });

  // 3. Seed the plan↔feature matrix.
  const features = await prisma.feature.findMany({ where: { slug: { in: [...FEATURES] } } });
  const idBySlug = new Map(features.map((f) => [f.slug, f.id]));
  const plans = await prisma.plan.findMany();
  let pfCount = 0;
  for (const plan of plans) {
    const enabledSet = new Set(PLAN_FEATURES[plan.slug] ?? []);
    for (const slug of FEATURES) {
      const featureId = idBySlug.get(slug);
      if (!featureId) continue;
      await prisma.planFeature.upsert({
        where: { planId_featureId: { planId: plan.id, featureId } },
        update: { enabled: enabledSet.has(slug) },
        create: { planId: plan.id, featureId, enabled: enabledSet.has(slug) },
      });
      pfCount++;
    }
  }

  console.log(
    `Synced ${FEATURES.length} features (retired ${retired.count}); seeded ${pfCount} PlanFeature rows across ${plans.length} plans (${plans
      .map((p) => p.slug)
      .join(", ")}).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
