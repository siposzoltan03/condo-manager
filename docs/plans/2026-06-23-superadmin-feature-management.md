# Superadmin Feature Management Console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `SUPER_ADMIN` a self-service console to control feature access platform-wide without code deploys. Four capabilities: (1) a **feature catalog** mapping which features each plan tier includes (replacing the hardcoded `FEATURE_PLAN_MAP` in `src/lib/feature-gate.ts` and the manual `Plan.features` JSON); (2) **per-building overrides** to grant/revoke a single feature for one building regardless of its plan (comps, beta access, custom deals); (3) **global feature flags** to force-on (rollout) or kill-switch a feature for everyone; (4) **plan limits & pricing** editing (maxBuildings, maxUnitsPerBuilding, prices, trial days, active flag). Today all of this requires editing seed data or code and redeploying.

**Architecture:** Six phases. Phase 1 adds the DB schema (the catalog, plan↔feature join, global flags, building overrides) and seeds it from code — no behavior change. Phase 2 rewrites the resolver to read access from the DB with a defined precedence, replacing the code-based map. Phases 3–5 build the three console surfaces (catalog + flags, plan editor, per-building overrides). Phase 6 wires cache invalidation, the audit trail, and acceptance tests.

**Source-of-truth split (the key design decision):**
- **Feature *slugs*** stay a typed enum in code (`src/lib/features.ts`). `requireFeature("voting.proxy")` must be compile-time checked; a superadmin must never be able to rename a slug and silently break a code reference.
- **Feature *assignment*** (which plan/building/flag enables a slug) moves to the DB and is editable by the superadmin. The `Feature` table mirrors the code enum (synced by a seed/sync script) and carries only editable *metadata* (display name, description, module, sort order, active).

**Resolution precedence** for "is feature F available to building B" (highest wins):
1. **Global kill-switch** (`FeatureFlag.state = KILL_SWITCH`) → unavailable to everyone. Absolute.
2. **Building override** (`BuildingFeatureOverride.grant` true/false, not expired) → wins over plan and force-on.
3. **Global force-on** (`FeatureFlag.state = FORCE_ON`) → available to everyone.
4. **Plan default** (`PlanFeature.enabled` for the building's subscription plan, honoring the trial rule) → the normal path.

**Dependency rule:** After the per-feature precedence resolves, a **dependency cascade** runs: a feature is only effective if *all* its prerequisites are effective (transitively). Dependencies are structural truth about features, so they live in code next to the slugs (`FEATURE_DEPENDENCIES` in `features.ts`), not in the editable DB metadata. This guarantees no nonsensical combination can reach runtime even via overrides or flags — kill-switching `finance.ledger` automatically removes `finance.bank-csv` and `finance.bank-sync-live`.

**Granularity:** Access resolves **per building** (the answer asked for building-level). The subscription's plan provides the default; building overrides layer on top. `getActiveFeatures` is keyed by `buildingId`.

**Tech Stack:** Prisma + Postgres, NextAuth v5 (`SUPER_ADMIN` role via `requireBuildingContext()` + `hasMinimumRole`), Next.js App Router, TypeScript, Zod. No new deps.

**Spec source:** Roadmap item ([`docs/ROADMAP.md`](../ROADMAP.md)). **Builds on and partially supersedes** [`docs/plans/2026-04-28-feature-gating-enforcement.md`](2026-04-28-feature-gating-enforcement.md): this plan replaces that plan's *code-as-source-of-truth* (`src/lib/plans.ts` `PLAN_FEATURES` const) with the DB catalog, and delivers its deferred "Customer-specific feature overrides" out-of-scope item. The typed `src/lib/features.ts` enum is **shared**; if the gating plan hasn't created it yet, Phase 1 here creates it.

**Non-goals:**
- In-building role permissions (`BoardPermission` / `UserBuildingPermission`) — different concern, unchanged.
- Self-serve plan/feature creation by non-superadmin users.
- Per-feature usage metering / overage billing.
- Stripe product/price *creation* from the console — superadmin pastes an existing Stripe Price ID; price objects are still managed in Stripe.
- A/B testing or percentage rollouts (force-on is all-or-nothing; see Out of scope).
- Defining new feature *slugs* from the UI (slugs are code-coupled; add them in `features.ts` + a migration).

---

## File Structure — What Changes

```
prisma/
├── schema.prisma                              # MODIFY: Feature, PlanFeature, FeatureFlag, BuildingFeatureOverride + relations
├── migrations/                                # NEW migration
├── seed.ts                                    # MODIFY: seed Feature rows + default PlanFeature matrix
└── sync-features.ts                           # NEW: idempotent sync of code enum → Feature table
src/
├── lib/
│   ├── features.ts                            # NEW (or shared w/ gating plan): typed FEATURES enum + Zod
│   ├── feature-gate.ts                        # REWRITE: DB-driven getActiveFeatures()/requireFeature() + precedence
│   ├── feature-resolver.ts                    # NEW: pure precedence logic (unit-testable, no DB)
│   └── feature-cache.ts                       # NEW: cached resolution + invalidation tags
├── app/
│   ├── [locale]/admin/
│   │   ├── features/page.tsx                  # NEW: catalog + global flags console
│   │   ├── plans/page.tsx                     # NEW: plan editor (feature matrix + limits + pricing)
│   │   └── buildings/[id]/features/page.tsx   # NEW: per-building override panel
│   ├── actions/admin-features.ts              # NEW: superadmin server actions (all SUPER_ADMIN-gated)
│   └── api/admin/
│       ├── features/route.ts                  # NEW: list/update feature metadata + flag state
│       ├── plans/[id]/features/route.ts       # NEW: toggle plan↔feature
│       ├── plans/[id]/route.ts                # NEW: edit limits/pricing
│       └── buildings/[id]/overrides/route.ts  # NEW: grant/revoke building override
└── components/admin/
    ├── feature-catalog-table.tsx              # NEW
    ├── plan-feature-matrix.tsx                # NEW
    └── building-override-panel.tsx            # NEW
```

---

## Phase 1: Schema + seed (no behavior change)

**Goal:** Land the tables and populate them to mirror today's hardcoded access. The resolver still uses the old code path at the end of this phase — this is a pure additive migration.

- [ ] **Step 1: `src/lib/features.ts`** — typed enum (reuse the gating plan's list if present, else create):
  ```ts
  export const FEATURES = [
    "voting.basic","voting.weighted","voting.proxy","voting.electronic",
    "finance.ledger","finance.budget","finance.bank-csv","finance.bank-sync-live","finance.pdf-report",
    "maintenance.tickets","maintenance.kanban","maintenance.contractors","maintenance.scheduled",
    "documents.basic","documents.versioning","documents.signing",
    "communication.announcements","communication.forum","communication.messages","communication.complaints",
    "audit.basic","audit.export",
    "platform.multi-building","platform.api","platform.sso","platform.custom-branding",
    "ai.minutes-summary","ai.classify",
  ] as const;
  export type Feature = (typeof FEATURES)[number];
  export const FeatureSchema = z.enum(FEATURES);

  // Feature dependencies — structural truth, so they live in code next to the
  // slugs and are NOT editable from the console. A feature is only ever
  // effective if all of its prerequisites are effective (see resolver cascade).
  export const FEATURE_DEPENDENCIES: Partial<Record<Feature, Feature[]>> = {
    "voting.weighted": ["voting.basic"],
    "voting.proxy": ["voting.basic"],
    "voting.electronic": ["voting.basic"],
    "finance.budget": ["finance.ledger"],
    "finance.bank-csv": ["finance.ledger"],
    "finance.bank-sync-live": ["finance.bank-csv"],   // transitive → finance.ledger
    "finance.pdf-report": ["finance.ledger"],
    "maintenance.kanban": ["maintenance.tickets"],
    "maintenance.contractors": ["maintenance.tickets"],
    "maintenance.scheduled": ["maintenance.tickets"],
    "documents.versioning": ["documents.basic"],
    "documents.signing": ["documents.basic"],
    "audit.export": ["audit.basic"],
  };
  ```

- [ ] **Step 2: Prisma schema** — add four models:
  ```prisma
  model Feature {
    id          String   @id @default(cuid())
    slug        String   @unique          // mirrors src/lib/features.ts; NEVER edited from UI
    module      String                    // "voting" | "finance" | ... (slug prefix)
    name        String                    // display name, editable
    description String?                   // editable
    sortOrder   Int      @default(0)
    isActive    Boolean  @default(true)   // retire a feature without deleting rows
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    planFeatures      PlanFeature[]
    flag              FeatureFlag?
    buildingOverrides BuildingFeatureOverride[]
  }

  model PlanFeature {
    id        String  @id @default(cuid())
    planId    String
    plan      Plan    @relation(fields: [planId], references: [id], onDelete: Cascade)
    featureId String
    feature   Feature @relation(fields: [featureId], references: [id], onDelete: Cascade)
    enabled   Boolean @default(false)
    @@unique([planId, featureId])
    @@index([planId])
  }

  enum FeatureFlagState { PER_PLAN FORCE_ON KILL_SWITCH }

  model FeatureFlag {
    id        String           @id @default(cuid())
    featureId String           @unique
    feature   Feature          @relation(fields: [featureId], references: [id], onDelete: Cascade)
    state     FeatureFlagState @default(PER_PLAN)
    note      String?
    updatedById String?
    updatedAt DateTime         @updatedAt
  }

  model BuildingFeatureOverride {
    id          String   @id @default(cuid())
    buildingId  String
    building    Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
    featureId   String
    feature     Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)
    grant       Boolean                       // true = force-grant, false = force-revoke
    reason      String?
    expiresAt   DateTime?                      // null = permanent
    createdById String?
    createdAt   DateTime @default(now())
    @@unique([buildingId, featureId])
    @@index([buildingId])
  }
  ```
  Add the back-relations on `Plan` (`planFeatures PlanFeature[]`) and `Building` (`featureOverrides BuildingFeatureOverride[]`). Keep `Plan.features Json` for now (dropped in Phase 6).

- [ ] **Step 3: Migration** — `prisma migrate dev --name superadmin_feature_management`.

- [ ] **Step 4: `prisma/sync-features.ts`** — idempotent: upsert a `Feature` row per code slug (module = slug prefix, name defaulted from slug), and mark any DB row whose slug is no longer in the enum `isActive=false` (never hard-delete — preserves history/overrides). Wire into `seed.ts` and document running it after every `features.ts` change.

- [ ] **Step 5: Seed the default matrix** — translate today's access into `PlanFeature` rows. Source: the gating plan's `PLAN_FEATURES` (kezdo/kepviselo/kezelo_iroda) if those tiers exist, else map from the legacy `FEATURE_PLAN_MAP` (starter/pro/enterprise) in `feature-gate.ts`. Every plan×feature pair gets a row with `enabled` true/false so the matrix UI has no holes.

- [ ] **Step 6: Commit** — `feat(admin): phase 1 — feature catalog schema + seed (no behavior change)`.

---

## Phase 2: DB-driven resolver

**Goal:** Replace the hardcoded map with DB resolution implementing the precedence rules. This is the integration seam with the gating plan.

- [ ] **Step 1: `src/lib/feature-resolver.ts`** — pure function, no DB, fully unit-testable:
  ```ts
  // inputs already loaded by the caller
  export function resolveFeature(args: {
    planEnabled: boolean;          // PlanFeature.enabled for the building's plan (trial rule pre-applied)
    flagState: FeatureFlagState;   // PER_PLAN | FORCE_ON | KILL_SWITCH
    override: boolean | null;      // BuildingFeatureOverride.grant, or null if none/expired
  }): boolean {
    if (args.flagState === "KILL_SWITCH") return false;   // 1. absolute
    if (args.override !== null) return args.override;       // 2. building override
    if (args.flagState === "FORCE_ON") return true;         // 3. global rollout
    return args.planEnabled;                                // 4. plan default
  }

  // Dependency cascade — drop any feature whose prerequisites aren't all
  // present. Iterates to a fixpoint so transitive chains (bank-sync-live →
  // bank-csv → ledger) collapse correctly. Runs AFTER per-feature resolution.
  export function applyDependencies(enabled: Set<Feature>): Set<Feature> {
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of [...enabled]) {
        const deps = FEATURE_DEPENDENCIES[f] ?? [];
        if (deps.some((d) => !enabled.has(d))) { enabled.delete(f); changed = true; }
      }
    }
    return enabled;
  }
  ```

- [ ] **Step 2: Rewrite `getActiveFeatures(buildingId)`** in `feature-gate.ts` to return `Set<Feature>`:
  - Load the building's subscription + plan (reuse existing logic incl. legacy "no subscription → allow all" and the **trial rule**: `TRIALING` resolves against the `kepviselo`/pro tier's `PlanFeature` rows, per the gating plan).
  - Load `PlanFeature` rows for that plan, all `FeatureFlag` rows, and non-expired `BuildingFeatureOverride` rows for the building — three indexed queries.
  - Run `resolveFeature` per active feature to get a **raw** set, then pass it through `applyDependencies()` so no feature survives without its prerequisites (e.g. a building override granting `voting.proxy` is dropped if `voting.basic` is kill-switched). The dependency-collapsed set is what `getActiveFeatures` returns.
  - `requireFeature(buildingId, slug)` throws `FeatureGateError` when not in the set (preserve current signature + legacy allow-through).

- [ ] **Step 3: Delete `FEATURE_PLAN_MAP`** and `featureToMinimumPlan`'s code source; if the UI still needs "minimum plan for feature" badges, derive it from `PlanFeature` (lowest-priced active plan whose `enabled=true`).

- [ ] **Step 4: Update callers** — `requireFeature` call sites already pass `buildingId`; confirm none relied on the removed map. `grep -rn "FEATURE_PLAN_MAP\|featureToMinimumPlan" src/` must return 0.

- [ ] **Step 5: Tests** — unit-test `resolveFeature` across the full precedence truth table (kill-switch beats grant, override beats force-on, expired override falls through to plan, etc.). Also unit-test `applyDependencies`: granting a dependent without its prereq drops the dependent; transitive chains collapse (kill-switching `finance.ledger` removes `finance.bank-sync-live`); a complete set is left untouched.

- [ ] **Step 6: Commit** — `feat(admin): phase 2 — DB-driven feature resolution + precedence`.

---

## Phase 3: Feature catalog + global flags console

**Goal:** `/admin/features` — superadmin sees every feature grouped by module, edits metadata, and sets the global flag.

- [ ] **Step 1: Page** `src/app/[locale]/admin/features/page.tsx` — server component, gated by `hasMinimumRole(role, "SUPER_ADMIN")` (redirect/403 otherwise). Loads features grouped by `module`.
- [ ] **Step 2: `feature-catalog-table.tsx`** — per row: slug (read-only, monospace), editable name/description, `isActive` toggle, and a global-flag selector (`PER_PLAN` / `FORCE_ON` / `KILL_SWITCH`) with a confirm dialog on `KILL_SWITCH` ("disables for ALL buildings").
- [ ] **Step 3: API** `PATCH /api/admin/features/route.ts` and server action in `actions/admin-features.ts` — validate with Zod, `SUPER_ADMIN`-gate, write `Feature` metadata and upsert `FeatureFlag`. Reject any attempt to change `slug`.
- [ ] **Step 4: Cache bust** — on any flag change, invalidate the feature cache (see Phase 6) so it takes effect without redeploy.
- [ ] **Step 5: Commit** — `feat(admin): phase 3 — feature catalog + global flag console`.

---

## Phase 4: Plan editor (feature matrix + limits + pricing)

**Goal:** `/admin/plans` — edit which features each plan includes, plus limits and pricing.

- [ ] **Step 1: Page** `src/app/[locale]/admin/plans/page.tsx`, `SUPER_ADMIN`-gated. Lists plans with their limits/pricing and an edit affordance.
- [ ] **Step 2: `plan-feature-matrix.tsx`** — features (rows, grouped by module) × plans (columns) checkbox grid backed by `PlanFeature.enabled`. Toggling a cell calls `POST /api/admin/plans/[id]/features` `{ featureId, enabled }`. **Dependency-aware:** enabling a feature auto-enables (and visually checks) its prerequisites from `FEATURE_DEPENDENCIES`; disabling a feature is blocked while a dependent is still enabled, with a tooltip naming the blocker. The API re-validates the dependency invariant server-side so the matrix can't be left inconsistent via a direct call.
- [ ] **Step 3: Plan limits/pricing form** — edit `maxBuildings`, `maxUnitsPerBuilding`, `priceMonthly`, `priceYearly`, `trialDays`, `isActive`, `stripePriceId`. `PATCH /api/admin/plans/[id]/route.ts`, Zod-validated (non-negative ints, decimal prices). Note that price edits affect **new** checkouts only; existing Stripe subscriptions keep their Stripe price until renewal — surface this as a warning in the form.
- [ ] **Step 4: Guard rails** — block deactivating a plan that has active subscriptions (or require a target plan to migrate them); warn when disabling a feature a plan's subscribers currently use.
- [ ] **Step 5: Cache bust** on every change.
- [ ] **Step 6: Commit** — `feat(admin): phase 4 — plan editor (feature matrix + limits + pricing)`.

---

## Phase 5: Per-building overrides

**Goal:** Grant/revoke a single feature for one building, with optional expiry. Reuses the existing `/admin/buildings` area.

- [ ] **Step 1: Page** `src/app/[locale]/admin/buildings/[id]/features/page.tsx`, `SUPER_ADMIN`-gated. Shows, per feature, the **effective** state (with a badge explaining *why*: "plan", "force-on", "kill-switch", "override") and lets the admin set/clear an override.
- [ ] **Step 2: `building-override-panel.tsx`** — per feature: a tri-state control (Inherit / Grant / Revoke), optional `reason` and `expiresAt`. "Inherit" deletes the override row. When granting a feature whose prerequisites won't be effective for this building, warn that the dependency cascade (Phase 2) will nullify the grant until the prereqs are also available.
- [ ] **Step 3: API** `POST/DELETE /api/admin/buildings/[id]/overrides/route.ts` — upsert/delete `BuildingFeatureOverride`, Zod-validated, `SUPER_ADMIN`-gated.
- [ ] **Step 4: Expiry worker** — a BullMQ scheduled job (reuse existing worker infra) that ignores expired overrides at resolution time (resolver already filters `expiresAt`); the worker just prunes expired rows nightly and audits the cleanup. Document that resolution is correct even before pruning.
- [ ] **Step 5: Cache bust** on override change for that building only.
- [ ] **Step 6: Commit** — `feat(admin): phase 5 — per-building feature overrides`.

---

## Phase 6: Cache, audit, cleanup, acceptance

**Goal:** Make changes take effect fast, leave an audit trail, and retire the old column.

- [ ] **Step 1: `src/lib/feature-cache.ts`** — wrap `getActiveFeatures` with cache keyed by `buildingId` using Next.js `unstable_cache` + tags (`features:building:<id>`, `features:plan:<planId>`, `features:global`). Console mutations call `revalidateTag(...)`. Replaces the per-request `planCache` map with a cross-request cache that's explicitly invalidated.
- [ ] **Step 2: Audit trail** — every superadmin mutation writes an `AuditLog` row (follow the existing `PLAN_OVERRIDE` precedent in `/api/admin/subscriptions/[id]/plan/route.ts`) with actions: `feature.flag.update`, `plan.feature.toggle`, `plan.limits.update`, `building.feature.override`, capturing old/new values.
- [ ] **Step 3: Admin audit visibility** — surface these rows in the existing audit viewer, filterable by these new actions.
- [ ] **Step 4: Drop `Plan.features`** — confirm `grep -rn "\.features" src/ | grep -i plan` shows no reads, then migration to drop the column.
- [ ] **Step 5: i18n** — add labels for the three console pages to `src/i18n/hu.json` + `en.json`.
- [ ] **Step 6: Commit** — `feat(admin): phase 6 — feature cache, audit trail, drop legacy column`.

---

## Out of scope (tracked for follow-up)

- **Percentage / cohort rollouts** (force-on to 10% of buildings). Current force-on is all-or-nothing. Add a `rolloutPercent` to `FeatureFlag` later.
- **Stripe price/product creation from the console** — superadmin pastes an existing Price ID; objects are created in Stripe.
- **Bulk overrides** (apply an override to all buildings of a subscription at once) — start per-building; revisit if a use case appears.
- **Override approval workflow** — single-superadmin action for now; no four-eyes.
- **User-editable dependency edges** — `FEATURE_DEPENDENCIES` is enforced (see Phases 1/2/4) but, like slugs, is code-owned; editing the dependency graph from the console is out of scope.

---

## Acceptance criteria

This plan is complete when:

1. A superadmin can enable a feature for the Kezdő plan from `/admin/plans` and a Kezdő building gains access within one page reload (cache revalidated), no deploy.
2. A `KILL_SWITCH` global flag makes a feature unavailable to **every** building regardless of plan or override.
3. A building-level **Grant** override unlocks a feature the building's plan does not include; a **Revoke** override hides one the plan does include.
4. Precedence holds exactly: kill-switch > building override > force-on > plan default — verified by the `resolveFeature` unit truth table.
5. An expired override stops taking effect at resolution time (not only after the nightly prune).
6. `grep -rn "FEATURE_PLAN_MAP" src/` returns 0, and `Plan.features` is dropped from the schema with no remaining reads.
7. The `Feature` table slugs match `src/lib/features.ts` 1:1 after `sync-features.ts` runs; renaming a slug in code + migration is the only way to change a slug.
8. Every console mutation produces an `AuditLog` row with the correct action and old/new values, visible in the audit viewer.
9. All `/admin/features`, `/admin/plans`, `/admin/buildings/[id]/features` routes and their APIs return 403 to non-`SUPER_ADMIN` users.
10. The trial rule still holds: a `TRIALING` subscription resolves against the Képviselő tier's `PlanFeature` rows.
11. Feature dependencies are enforced end-to-end: the plan editor won't enable `voting.proxy` without `voting.basic`, and at runtime `applyDependencies` drops any feature whose prerequisites aren't effective, including transitively (kill-switching `finance.ledger` removes `finance.bank-sync-live`).

When all eleven hold, the superadmin owns feature access end-to-end from the UI, and code deploys are no longer required to change who gets what.
