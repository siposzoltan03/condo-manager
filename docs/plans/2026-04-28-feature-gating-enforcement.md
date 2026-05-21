# Feature Gating Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Plan.features` from a free-form JSON column into a typed, server-enforced feature taxonomy. Lock tier names to the marketing copy (Kezdő / Képviselő / Kezelő iroda). Replace USD-priced seed rows with HUF prices. Wire server-side enforcement at every server-action and API-route boundary, plus a consistent client-side UX (sidebar lock badges, upgrade modal). Without this, the pricing page promises features the code doesn't gate, and Stripe is misconfigured for the Hungarian market.

**Architecture:** Five phases. Phase 1 lays the typed contract without enforcing it. Phase 2 fixes the pricing data and Stripe. Phase 3 instruments enforcement. Phase 4 adds the client UX. Phase 5 hard-caps plan limits.

**Tech Stack:** Prisma, NextAuth v5, Stripe (`stripe` dep already present), TypeScript, Zod (existing if installed; add otherwise).

**Spec source:** Audit findings dated 2026-04-28. **Augments and partially supersedes** `docs/plans/2026-03-30-subscriptions-schema-invitations-gating.md`.

**Non-goals:**
- Per-feature usage metering and overage billing.
- Self-serve plan creation by users.
- Per-customer custom plans (Kezelő iroda is templated, not bespoke).
- Replacing the existing checkout flow — the upgrade modal hands off.
- Stripe webhook hardening (separate plan).

---

## File Structure — What Changes

```
src/
├── lib/
│   ├── features.ts                          # NEW: typed FEATURE const + Zod
│   ├── plans.ts                             # NEW: tier→features mapping (source of truth)
│   ├── feature-gate.ts                      # MODIFY: requireFeature(), hasFeature()
│   └── plan-limits.ts                       # MODIFY: extend with checkAdminLimit
├── components/
│   └── shared/
│       ├── FeatureGate.tsx                  # NEW: <FeatureGate feature="...">
│       └── UpgradeModal.tsx                 # NEW: shows current vs. target plan
├── hooks/
│   └── use-plan-features.ts                 # NEW: client hook returning Set<Feature>
prisma/
├── seed.ts                                  # MODIFY: rename tiers, switch to HUF
└── migrations/                              # NEW migration: rename Plan rows
.env.example                                 # MODIFY: Stripe Price IDs for HUF prices
```

No Prisma schema changes — `Plan.features` JSON column is preserved for backward compat but ignored after Phase 1.

---

## Phase 1: Typed feature taxonomy + tier mapping

**Goal:** Establish the canonical feature names and the tier→features mapping. No enforcement yet — read-only contract.

- [ ] **Step 1: Create `src/lib/features.ts`**:
  ```ts
  export const FEATURES = [
    // Voting
    "voting.basic", "voting.weighted", "voting.proxy", "voting.electronic",
    // Finance
    "finance.ledger", "finance.budget", "finance.bank-csv", "finance.bank-sync-live", "finance.pdf-report",
    // Maintenance
    "maintenance.tickets", "maintenance.kanban", "maintenance.contractors", "maintenance.scheduled",
    // Documents
    "documents.basic", "documents.versioning", "documents.signing",
    // Communication
    "communication.announcements", "communication.forum", "communication.messages", "communication.complaints",
    // Audit
    "audit.basic", "audit.export",
    // Platform
    "platform.multi-building", "platform.api", "platform.sso", "platform.custom-branding",
    // AI
    "ai.minutes-summary", "ai.classify",
  ] as const;
  export type Feature = (typeof FEATURES)[number];
  export const FeatureSchema = z.enum(FEATURES);
  ```
  Naming convention: `module.capability`. New features go here, never as raw strings.

- [ ] **Step 2: Create `src/lib/plans.ts`** with the canonical tier→features mapping:
  ```ts
  export const PLAN_FEATURES: Record<PlanSlug, ReadonlySet<Feature>> = {
    kezdo: new Set([
      "voting.basic", "voting.weighted",
      "finance.ledger",
      "maintenance.tickets",
      "documents.basic",
      "communication.announcements", "communication.forum", "communication.complaints",
      "audit.basic",
    ]),
    kepviselo: new Set([
      ...PLAN_FEATURES.kezdo,
      "voting.proxy", "voting.electronic",
      "finance.budget", "finance.bank-csv", "finance.pdf-report",
      "maintenance.kanban", "maintenance.contractors", "maintenance.scheduled",
      "documents.versioning",
      "communication.messages",
      "audit.export",
      "platform.multi-building",
    ]),
    kezelo_iroda: new Set([
      ...PLAN_FEATURES.kepviselo,
      "finance.bank-sync-live",
      "documents.signing",
      "platform.api", "platform.sso", "platform.custom-branding",
      "ai.minutes-summary", "ai.classify",
    ]),
  };
  ```

- [ ] **Step 3: Loader hook**. `getActiveFeatures(userId, buildingId): Promise<Set<Feature>>`. Reads the Subscription tied to the building, looks up `PLAN_FEATURES[plan.slug]`. **Trial scope rule**: if `subscriptionStatus === 'TRIALING'`, return `PLAN_FEATURES.kepviselo` regardless of which plan was picked, so prospects can evaluate the meat of the product. Document this in JSDoc.

- [ ] **Step 4: No enforcement yet — commit the contract**
  ```bash
  git commit -m "feat(plans): phase 1 — typed feature taxonomy + tier mapping"
  ```

---

## Phase 2: Tier rename + HUF prices

**Goal:** Rename `Plan` rows from Starter / Professional / Enterprise to Kezdő / Képviselő / Kezelő iroda, swap USD prices for HUF, update Stripe Price IDs.

- [ ] **Step 1: Decide HUF prices**. Reference: business plan section 4 (`docs/business-plan/business-plan-2026-04.md`) currently says 79 / 119 / 169 Ft per **lakás per month**. Pricing page in design shows whole-building monthly. Confirm with stakeholder which model — this plan assumes per-building monthly:
  - **Kezdő**: 7 900 Ft / month (monthly), 79 000 Ft / year (yearly).
  - **Képviselő**: 19 900 Ft / month, 199 000 Ft / year.
  - **Kezelő iroda**: 49 900 Ft / month, 499 000 Ft / year.
  Numbers are placeholder until business plan is updated; the rename and currency swap are independent.

- [ ] **Step 2: Stripe Price IDs**. In the Stripe dashboard (or via API), create six new prices in **HUF**:
  - `price_kezdo_monthly_huf`, `price_kezdo_yearly_huf`
  - `price_kepviselo_monthly_huf`, `price_kepviselo_yearly_huf`
  - `price_kezelo_iroda_monthly_huf`, `price_kezelo_iroda_yearly_huf`
  
  Old USD prices are archived (not deleted; existing subscribers stay on them until renewal). Document the swap as a runbook in `docs/runbooks/stripe-tier-rename-2026.md`.

- [ ] **Step 3: Migration script** at `prisma/migrate-plan-rename.ts`:
  ```ts
  await prisma.plan.update({
    where: { slug: "starter" },
    data: { name: "Kezdő", slug: "kezdo", priceMonthly: 7900, priceYearly: 79000, stripePriceId: process.env.STRIPE_PRICE_KEZDO_MONTHLY_HUF },
  });
  // ... same for professional → kepviselo, enterprise → kezelo_iroda
  ```
  Run after `prisma migrate dev --create-only` for the env-var changes.

- [ ] **Step 4: Update `prisma/seed.ts`** so fresh dev DBs come up with the HU tier names and HUF prices.

- [ ] **Step 5: i18n**. Add tier names to `src/i18n/messages/hu.json` and `en.json` under `plan.kezdo.name`, etc. Pricing page renders from i18n + DB.

- [ ] **Step 6: Lock the trial period to 14 days**. `Plan.trialDays` already defaults to 14 — verify all three rows are at 14. Update business plan doc to match (it currently says 3 months).

- [ ] **Step 7: Commit**
  ```bash
  git commit -m "feat(plans): phase 2 — Hungarian tier names + HUF prices + Stripe rename"
  ```

---

## Phase 3: Server-side enforcement

**Goal:** Every server action and API route that the marketing page promises checks the feature gate.

- [ ] **Step 1: `requireFeature(feature: Feature)` in `src/lib/feature-gate.ts`**:
  ```ts
  export class FeatureGateError extends Error {
    constructor(public feature: Feature) {
      super(`Feature gated: ${feature}`);
    }
  }
  export async function requireFeature(feature: Feature): Promise<void> {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthenticated");
    const features = await getActiveFeatures(session.user.id, session.user.activeBuildingId);
    if (!features.has(feature)) throw new FeatureGateError(feature);
  }
  ```

- [ ] **Step 2: API-route wrapper** `withFeature(feature, handler)`:
  ```ts
  export const withFeature = (feature: Feature, handler: NextHandler) =>
    async (req: NextRequest, ctx: RouteCtx) => {
      try { await requireFeature(feature); }
      catch (e) {
        if (e instanceof FeatureGateError) return Response.json({ error: "feature-gated", feature }, { status: 402 });
        throw e;
      }
      return handler(req, ctx);
    };
  ```

- [ ] **Step 3: Instrument server actions**. List of actions to gate (one per row of the marketing page's tier features):

  | Action | Feature required |
  |---|---|
  | `createVote` | `voting.basic` |
  | `createVote` with `weightingMode = SHARES` | `voting.weighted` |
  | `grantProxy` | `voting.proxy` |
  | `submitElectronicBallot` | `voting.electronic` |
  | `importBankCsv` | `finance.bank-csv` |
  | `triggerLiveBankSync` | `finance.bank-sync-live` |
  | `generateFinancePdf` | `finance.pdf-report` |
  | `assignContractor` | `maintenance.contractors` |
  | `scheduleRecurringMaintenance` | `maintenance.scheduled` |
  | `restoreDocumentVersion` | `documents.versioning` |
  | `signDocument` | `documents.signing` |
  | `sendMessage` | `communication.messages` |
  | `exportAuditLog` | `audit.export` |
  | `createBuilding` | `platform.multi-building` (≥2 buildings) |

  Wrap each with `await requireFeature("...");` at the top.

- [ ] **Step 4: Centralized error boundary**. `FeatureGateError` is caught by the existing server-action error handler and returned as `{ error: "feature-gated", feature, requiredPlan }`. The client uses this to open the upgrade modal (Phase 4).

- [ ] **Step 5: Audit log**. Every gate hit creates an `AuditLog` row with action `feature-gate.deny` and the feature name. Useful for telemetry: which features are most-attempted by users on lower tiers (= upgrade signal).

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(plans): phase 3 — server-side feature gate enforcement"
  ```

---

## Phase 4: Client-side gating UX

**Goal:** Sidebar shows lock badges. Disabled buttons. Upgrade modal triggered by gate hits or by clicking a locked sidebar item.

- [ ] **Step 1: `usePlanFeatures()` hook** — wraps a fetch to `/api/plan/features` (which calls `getActiveFeatures`). SWR or React Query cache; revalidates on plan-change events.

- [ ] **Step 2: `<FeatureGate feature="...">`**:
  ```tsx
  <FeatureGate feature="voting.proxy" fallback={<LockedBadge />}>
    <ProxyForm />
  </FeatureGate>
  ```

- [ ] **Step 3: Sidebar updates**. Each item that maps to a feature gets:
  - If feature available: render normally.
  - If feature gated: render disabled + lock icon + "Csak Képviselő tervben" badge. Click opens UpgradeModal.

- [ ] **Step 4: `<UpgradeModal>`**. Shows: caller's current plan, the target plan that includes the feature, monthly/yearly toggle, "Frissítés most" CTA → existing `/checkout/[planSlug]` route. Cancel just closes.

- [ ] **Step 5: Telemetry**. Every UpgradeModal open emits an event (the same `feature-gate.deny` audit row from Phase 3, or a separate analytics call). Used to prioritize which features to promote.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(plans): phase 4 — client-side gate UI + upgrade modal"
  ```

---

## Phase 5: Plan limits hard cap

**Goal:** Block create endpoints when at the cap. Surface upgrade CTA in the UI.

- [ ] **Step 1: `checkBuildingLimit`, `checkUnitLimit` already exist** (per the prior subscriptions plan). Verify they're called from `createBuilding` and `createUnit` server actions; add `throw new PlanLimitError(...)` if missing.

- [ ] **Step 2: New `checkAdminLimit`**. Counts UserBuilding rows with `role IN (ADMIN, BOARD_MEMBER + isChair)`. Compared against tier limit:
  - Kezdő: 1
  - Képviselő: 5
  - Kezelő iroda: unlimited (no check)

  Called from the invitation send flow — block sending invites that would exceed the cap.

- [ ] **Step 3: UI surfacing**. On a building list with usage near cap (e.g. 4/5 admins on Képviselő), show a yellow warning "Hamarosan eléri a tervkorlátot — frissíts Kezelő iroda tervre". Same UpgradeModal handler as Phase 4.

- [ ] **Step 4: Grandfathering on downgrade**. If a Képviselő customer downgrades to Kezdő and they have 3 buildings, the downgrade is allowed but they enter a 30-day grace period during which they can keep using all 3. After 30 days, all but one are read-only. Implement as a `gracePeriodEndsAt` field on Subscription.

- [ ] **Step 5: Migration**: add `Subscription.gracePeriodEndsAt DateTime?`.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(plans): phase 5 — plan limits hard cap + grace period"
  ```

---

## Out of scope (tracked for follow-up)

- **Per-call rate limiting beyond plan limits** (e.g. AI minute summarization at 50 calls/month even on Kezelő iroda). Separate plan.
- **Stripe webhook signing + retry hardening** — separate plan, but cross-reference here.
- **Customer-specific feature overrides** ("this Kezdő customer gets `documents.versioning` for free as a deal"). Not yet — add a `Subscription.featureOverrides JSON` column when the first such deal is signed.
- **Plan A/B testing**.
- **Annual prepayment discount UI** — Stripe handles the math; no extra logic needed at the gating layer.

---

## Acceptance criteria

This plan is complete when:

1. A Kezdő-plan subscription cannot create a 2nd building — server action throws `PlanLimitError`, UI shows UpgradeModal.
2. `Plan.features` JSON column is no longer read by any code — `grep -r "plan.features" src/` returns 0 reads.
3. Upgrading from Kezdő to Képviselő unlocks Voting in the sidebar within one page reload.
4. A `TRIALING` subscription has access to all Képviselő-level features regardless of which plan was selected at signup.
5. After plan downgrade, features remain accessible until `gracePeriodEndsAt`; subsequent renewal removes them.
6. The pricing page tier names match `Plan.name` 1:1 across UI and DB (Kezdő / Képviselő / Kezelő iroda).
7. HUF prices on the pricing page match the Stripe Price IDs in `process.env`.
8. A non-multi-building user calling `POST /api/buildings` gets HTTP **402** with a feature-gated payload, not 200.
9. Every gate hit produces an `AuditLog` row with `action = feature-gate.deny`.
10. The `<FeatureGate>` component is the only path to render a feature-gated UI surface — eslint rule disallows raw conditional rendering on plan slugs.

When all ten hold, feature gating is production-ready and the pricing page stops over-promising.
