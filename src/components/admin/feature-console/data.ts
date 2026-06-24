import {
  FEATURES,
  FEATURE_DEPENDENCIES,
  featureModule,
  type Feature,
  type FeatureModule,
} from "@/lib/features";
import type { FeatureFlagState } from "@/lib/feature-resolver";

/**
 * UI seed data for the superadmin feature console.
 *
 * ⚠️ MOCK DATA — this is the in-memory model the console renders against
 * until Phases 1–2 land the DB catalog + resolver-backed APIs. Feature
 * *slugs* and dependencies come from the canonical src/lib/features.ts;
 * the display metadata + default plan matrix below stand in for the future
 * `Feature`, `PlanFeature`, `FeatureFlag` and `BuildingFeatureOverride`
 * rows. Replace with server data in the API-wiring step.
 */

export type PlanSlug = "kezdo" | "kepviselo" | "kezelo_iroda";

// Display names + glosses are translated (featureConsole.modules.<module>);
// only the non-translatable glyph lives here.
export const MODULE_GLYPH: Record<FeatureModule, string> = {
  voting: "Sz",
  finance: "Pé",
  maintenance: "Ka",
  documents: "Do",
  communication: "Ko",
  audit: "Au",
  platform: "Pl",
  ai: "AI",
};

export const MODULE_ORDER: FeatureModule[] = [
  "voting",
  "finance",
  "maintenance",
  "documents",
  "communication",
  "audit",
  "platform",
  "ai",
];

export interface FeatureMeta {
  beta?: boolean;
  by: string;
  when: string;
}

/**
 * Non-display feature metadata — future `Feature` table columns. Display
 * name + description are translated (featureConsole.features.<module>.<cap>),
 * not stored here.
 */
export const FEATURE_META: Record<Feature, FeatureMeta> = {
  "voting.basic": { by: "Rendszer", when: "2026.02.11" },
  "voting.weighted": { by: "Kovács A.", when: "2026.03.30" },
  "voting.proxy": { by: "Kovács A.", when: "2026.04.18" },
  "voting.electronic": { by: "Nagy P.", when: "2026.04.22" },
  "finance.ledger": { by: "Rendszer", when: "2026.02.11" },
  "finance.budget": { by: "Kovács A.", when: "2026.03.12" },
  "finance.bank-csv": { by: "Kovács A.", when: "2026.04.27" },
  "finance.bank-sync-live": { beta: true, by: "Nagy P.", when: "2026.05.09" },
  "finance.pdf-report": { by: "Kovács A.", when: "2026.04.05" },
  "maintenance.tickets": { by: "Rendszer", when: "2026.02.11" },
  "maintenance.kanban": { by: "Kovács A.", when: "2026.03.20" },
  "maintenance.contractors": { by: "Kovács A.", when: "2026.06.01" },
  "maintenance.scheduled": { by: "Nagy P.", when: "2026.05.14" },
  "documents.basic": { by: "Rendszer", when: "2026.02.11" },
  "documents.versioning": { by: "Kovács A.", when: "2026.03.28" },
  "documents.signing": { beta: true, by: "Nagy P.", when: "2026.06.12" },
  "communication.announcements": { by: "Nagy P.", when: "2026.06.10" },
  "communication.forum": { by: "Rendszer", when: "2026.02.11" },
  "communication.messages": { by: "Kovács A.", when: "2026.03.18" },
  "communication.complaints": { by: "Rendszer", when: "2026.02.11" },
  "audit.basic": { by: "Rendszer", when: "2026.02.11" },
  "audit.export": { by: "Kovács A.", when: "2026.05.21" },
  "platform.multi-building": { by: "Kovács A.", when: "2026.03.28" },
  "platform.api": { by: "Nagy P.", when: "2026.05.30" },
  "platform.sso": { by: "Nagy P.", when: "2026.06.02" },
  "platform.custom-branding": { by: "Kovács A.", when: "2026.05.18" },
  "ai.minutes-summary": { beta: true, by: "Nagy P.", when: "2026.06.15" },
  "ai.classify": { beta: true, by: "Nagy P.", when: "2026.06.20" },
};

/**
 * Builds the i18n key path for a feature's translated name/desc:
 * "finance.bank-csv" → "features.finance.bank-csv". The slug's dot maps to
 * the module nesting; the capability segment is one key.
 */
export function featureI18nKey(slug: Feature): string {
  return `features.${slug}`;
}

// Display name + gloss are translated (featureConsole.plans.<slug>); only the
// editable/structural fields live here (future `Plan` table columns).
export interface PlanDef {
  slug: PlanSlug;
  featured?: boolean;
  maxBuildings: string; // string to allow "∞"
  maxUnits: string;
  priceMonthly: string;
  priceYearly: string;
  trialDays: number;
  isActive: boolean;
  stripePriceId: string;
  /** active subscription count — drives the deactivation guard-rail. */
  activeSubscriptions: number;
}

export const PLANS: PlanDef[] = [
  { slug: "kezdo", maxBuildings: "1", maxUnits: "30", priceMonthly: "7 900", priceYearly: "79 000", trialDays: 14, isActive: true, stripePriceId: "price_kezdo_monthly_huf", activeSubscriptions: 118 },
  { slug: "kepviselo", featured: true, maxBuildings: "5", maxUnits: "100", priceMonthly: "19 900", priceYearly: "199 000", trialDays: 14, isActive: true, stripePriceId: "price_kepviselo_monthly_huf", activeSubscriptions: 241 },
  { slug: "kezelo_iroda", maxBuildings: "∞", maxUnits: "∞", priceMonthly: "49 900", priceYearly: "499 000", trialDays: 14, isActive: true, stripePriceId: "price_kezelo_iroda_monthly_huf", activeSubscriptions: 53 },
];

/** Default plan→feature matrix (future `PlanFeature` rows). Mirrors the
 *  gating plan's PLAN_FEATURES tiers. */
const KEZDO: Feature[] = [
  "voting.basic", "voting.weighted",
  "finance.ledger",
  "maintenance.tickets",
  "documents.basic",
  "communication.announcements", "communication.forum", "communication.complaints",
  "audit.basic",
];
const KEPVISELO: Feature[] = [
  ...KEZDO,
  "voting.proxy", "voting.electronic",
  "finance.budget", "finance.bank-csv", "finance.pdf-report",
  "maintenance.kanban", "maintenance.contractors", "maintenance.scheduled",
  "documents.versioning",
  "communication.messages",
  "audit.export",
  "platform.multi-building",
];
const KEZELO_IRODA: Feature[] = [
  ...KEPVISELO,
  "finance.bank-sync-live",
  "documents.signing",
  "platform.api", "platform.sso", "platform.custom-branding",
  "ai.minutes-summary", "ai.classify",
];

export const DEFAULT_PLAN_FEATURES: Record<PlanSlug, Feature[]> = {
  kezdo: KEZDO,
  kepviselo: KEPVISELO,
  kezelo_iroda: KEZELO_IRODA,
};

/** Global flags (future `FeatureFlag` rows). Default PER_PLAN; two examples. */
export const DEFAULT_FLAGS: Partial<Record<Feature, FeatureFlagState>> = {
  "communication.announcements": "FORCE_ON",
  "ai.classify": "KILL_SWITCH",
};

export function flagOf(
  flags: Partial<Record<Feature, FeatureFlagState>>,
  slug: Feature
): FeatureFlagState {
  return flags[slug] ?? "PER_PLAN";
}

/** isActive defaults — everything on except the kill-switched experiment. */
export const DEFAULT_ACTIVE: Partial<Record<Feature, boolean>> = {
  "ai.classify": false,
};

// ── Building override screen sample ──────────────────────────────────────
// Building-instance data (future `Building` row). The plan *name* and status
// label are translated (plans.* / overrides.statusActive), not stored here.
export interface BuildingMeta {
  slug: string;
  name: string;
  initials: string;
  addr: string;
  plan: PlanSlug;
  units: number;
  renews: string;
}

export const SAMPLE_BUILDING: BuildingMeta = {
  slug: "duna-residence",
  name: "Duna Residence",
  initials: "DR",
  addr: "1138 BUDAPEST · MARGITSZIGET RAKPART 47.",
  plan: "kepviselo",
  units: 84,
  renews: "2026.09.01",
};

export type OverrideState = "inherit" | "grant" | "revoke";
export interface OverrideRow {
  state: OverrideState;
  reason: string;
  expiry: string;
}

export const SAMPLE_OVERRIDES: Partial<Record<Feature, OverrideRow>> = {
  "finance.bank-sync-live": { state: "grant", reason: "Pilot ügyfél — korai bankszinkron-hozzáférés", expiry: "2026-12-31" },
  "finance.bank-csv": { state: "revoke", reason: "Ügyfél kérésére kikapcsolva (adatvédelmi audit)", expiry: "" },
  "voting.electronic": { state: "revoke", reason: "IB döntés: papír alapú szavazás 2026-ban", expiry: "2026-12-31" },
};

export function featuresInModule(mod: FeatureModule): Feature[] {
  return FEATURES.filter((f) => featureModule(f) === mod);
}

export function depList(slug: Feature): Feature[] {
  return FEATURE_DEPENDENCIES[slug] ?? [];
}
