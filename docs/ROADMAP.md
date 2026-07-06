# Condo Manager — Roadmap

Single source of truth for what's shipped, what's in progress, and what's planned.
This is a living document — update the status column when a plan moves.

- **Detailed build plans:** [`docs/plans/`](plans/)
- **Module map:** [`docs/modules-overview.md`](modules-overview.md)
- **Commercial plan:** [`docs/business-plan/business-plan-2026-04.md`](business-plan/business-plan-2026-04.md)

_Last updated: 2026-07-06 — reconciled against the codebase (PRs #81–#138). Corrected the superadmin console (was mis-marked "not started" — it shipped), reclassified feature-gating enforcement (DB-driven enforcement shipped), and added the large legal/governance/compliance + live-assembly + platform-admin work that had not been recorded here._

Status legend: ✅ Shipped · 🟡 In progress / partial · ⬜ Planned (not started)

---

## Product backlog

### Core platform

| Status | Item | Plan |
|--------|------|------|
| ✅ | Multi-building foundation (per-building roles, units) | [multi-building-migration](plans/2026-03-28-multi-building-migration.md) |
| ✅ | Unit management (ownership shares → voting weight) | [unit-management](plans/2026-03-31-unit-management.md) |
| ✅ | Subscriptions schema, invitations, gating scaffold | [subscriptions-schema](plans/2026-03-30-subscriptions-schema-invitations-gating.md) |
| ✅ | Stripe billing (checkout, webhooks, portal) | [stripe-integration](plans/2026-03-30-stripe-integration-billing.md) |
| ✅ | Public marketing pages (landing, pricing, checkout) | [public-pages](plans/2026-03-30-public-pages-landing-pricing.md) |
| ✅ | Self-serve registration (email verify, 2FA, sessions) | [self-serve-registration](plans/2026-04-28-self-serve-registration.md) |
| ✅ | Next.js App Router refactor | [app-router-refactoring](plans/2026-04-01-nextjs-app-router-refactoring.md) |
| ✅ | Code organization refactor (shells, DAL, RBAC, i18n) | [code-organization-refactor](plans/2026-05-13-code-organization-refactor.md) |

### Feature modules

| Status | Item | Plan |
|--------|------|------|
| ✅ | Communication & collaboration (channels, complaints, mediation) | [communication](plans/2026-03-25-condo-manager-communication.md), [communication-hub-refactor](plans/2026-04-28-communication-hub-refactor.md) |
| ✅ | Finance (ledger, unit charges, budgets, KPIs) | [finance](plans/2026-03-26-condo-manager-finance.md) |
| ✅ | Maintenance (workflow, SLA, scheduled, contractor assignment) | [maintenance](plans/2026-03-27-condo-manager-maintenance.md) |
| ✅ | Documents (storage, versioning, role visibility) | [documents](plans/2026-03-28-condo-manager-documents.md), [file-storage-strategy](plans/2026-04-28-file-storage-strategy.md) |
| ✅ | Voting & meetings (share-weighted, secret ballot, minutes) | [voting](plans/2026-03-28-condo-manager-voting.md) |
| ✅ | Contractor marketplace (portal, bids, invoices) | [contractor-marketplace](plans/2026-05-11-contractor-marketplace.md) |

### Infrastructure & compliance

| Status | Item | Plan |
|--------|------|------|
| ✅ | Real-time pub/sub + worker queue (BullMQ + Redis) | [real-time-infrastructure](plans/2026-04-28-real-time-infrastructure.md) |
| ✅ | Server-side PDF reporting (version hashing) | [pdf-reporting](plans/2026-04-28-pdf-reporting.md) |
| ✅ | Audit log UI + export | [audit-ui-and-export](plans/2026-04-28-audit-ui-and-export.md) |
| ✅ | Hungarian condo-law alignment (phases 1–5, cameras, GDPR) | [roles-legal-alignment](plans/2026-04-27-roles-legal-alignment.md) |
| 🟡 | Mobile / responsive (baseline shipped; polish ongoing) | [mobile-responsive](plans/2026-05-18-mobile-responsive.md) |

### Onboarding & governance (Tht. alignment)

Shipped since the last roadmap update; no dedicated plan files — see the PRs.

| Status | Item | Ref |
|--------|------|-----|
| ✅ | Multi-step building onboarding wizard + setup checklist | PRs #97–#101 |
| ✅ | AI SZMSZ / alapító okirat PDF extraction (units + governance), async via worker | PRs #103, #115–#117 |
| ✅ | Founding-deed ↔ SZMSZ separation: doc typing by legal role, role-scoped extraction | PRs #120–#122 |
| ✅ | Ownership shares as legal-register data (gated) + attested amend flow | PRs #123–#124 |
| ✅ | Document version compare (exact text diff) | PR #119 |
| ✅ | Governance changes via assembly resolution + bylaws settings page | PRs #112, #114 |
| ✅ | Per-member board-permission grants enforced in `can()` (GRANT_UNLOCKS) | PRs #107–#108 |
| ✅ | Dual-control resident removal (two-person control) | PRs #109–#110 |
| ✅ | Founding-deed special rights (exclusive-use / pre-emption / parking / storage) — extraction + register | PR #136 |

### Live assembly mode (Közgyűlés Mód)

| Status | Item | Ref |
|--------|------|-----|
| ✅ | Live presenter + SSE session (start/adjourn) | PRs #81–#82 |
| ✅ | Attendee companion phone view | PR #83 |
| ✅ | Live Q&A + raise-hand | PR #84 |
| ✅ | Auto-minutes draft on adjournment | PR #85 |
| ✅ | Presence gate, proxy (meghatalmazás) voting, multi-unit ballots, minutes signatures | PRs #87–#93 |

### E-voting legal compliance

Plan: [evoting-legal-compliance](plans/2026-07-02-evoting-legal-compliance.md). P0 enforcement is in code; live real voting is gated on external legal review of the P0.3 drafts.

| Status | Item | Ref |
|--------|------|-----|
| ✅ | Secret-ballot process-audit secrecy + timestamp quantization | PRs #127, #131 |
| ✅ | Eligible-electorate snapshot at vote open (turnout integrity) | PR #133 |
| ✅ | Remote/electronic assembly gated on SZMSZ authorization (AI-detect on upload + assembly-vote amendment; no checkbox) | PRs #128–#130 |
| ✅ | Jegyzőkönyv content-hash + versioning + Tht. § 43 delivery receipts + 8-day overdue job | PR #137 |
| ✅ | GDPR data-subject rights: Art. 15 self-export + Art. 17 erasure/anonymize | PR #135 |
| ✅ | Data-retention purge worker (stale sessions) | PR #134 |
| 🟡 | DPIA / data-processing notice / retention-policy — **drafts** written, pending counsel | PR #132 |
| ⬜ | In-app privacy notice wired to login + settings | **Blocked** on legal finalization of the drafts above |

### Platform admin

| Status | Item | Ref |
|--------|------|-----|
| ✅ | Superadmin feature-management console (DB-driven catalog / plan matrix / per-building overrides / kill-switches) + enforcement | commit 21663c4 · [superadmin-feature-management](plans/2026-06-23-superadmin-feature-management.md) |
| ✅ | SUPER_ADMIN read-only impersonation (view-as-user, middleware-enforced read-only, audited) | commit 334b9d9 |

### Planned / genuinely open

The real remaining backlog (verified against code — nothing here has an implementation yet beyond what's noted).

| Status | Item | Notes | Plan |
|--------|------|-------|------|
| ⬜ | **Banking integrations** | Biggest open item. Only a generic ledger-CSV import exists (`src/lib/finance/csv-import.ts`); no bank-specific parsers, reconciliation, MT940/CAMT.053, or PSD2. `finance.bank-csv` / `finance.bank-sync-live` slugs exist in the taxonomy but aren't wired. Gates the premium tier + the *"élő bankszinkron"* claim. | [banking-integrations-research](plans/2026-04-28-banking-integrations-research.md) |
| 🟡 | **Feature-gating: tier rename + pricing lock** | DB-driven enforcement, HUF pricing fields, and hard plan-limit caps (maxBuildings/maxUnits) all shipped. Remaining: rename plan slugs starter/pro/enterprise/legacy → **Kezdő / Képviselő / Kezelő iroda** and lock final HUF prices. | [feature-gating-enforcement](plans/2026-04-28-feature-gating-enforcement.md) |
| 🟡 | **Feature-console polish** | Surface the audit rows it already writes; drop the now-dead `Plan.features` column; add resolver truth-table tests. | [superadmin-feature-management](plans/2026-06-23-superadmin-feature-management.md) |
| 🟡 | **Mobile / responsive polish** | Baseline shipped; ongoing refinement. | [mobile-responsive](plans/2026-05-18-mobile-responsive.md) |

---

## Commercial roadmap (Go-to-Market)

From [business plan §6](business-plan/business-plan-2026-04.md). Break-even target: ~35 buildings (~1,400 units).

### Phase 1 — Validation (months 1–6)
- **Goal:** 20 buildings, product-market fit
- 5 pilot buildings (free in exchange for feedback), launch in AGM season
- Landing page + email list + voting-module demo video
- Presence in közös képviselő forums / Facebook groups (expert positioning)
- MITOE outreach (potential partnership)
- **KPIs:** 5 active pilots · 20 registered managers · 1 successful AGM run through the system

### Phase 2 — Growth (months 7–18)
- **Goal:** 60–150 buildings, revenue start
- Paid plans launch (after 3-month free trial)
- Referral program; outreach to top 50 Budapest management companies
- Content marketing (blog, YouTube), SEO
- **KPIs:** 60+ paying buildings · €600+ MRR · <5% monthly churn

### Phase 3 — Scale (months 19–36)
- **Goal:** 200–1,000 buildings, profitability
- Premium tier (bank sync, NAV)
- Management-company / white-label partnerships
- Regional expansion (Debrecen, Szeged, Pécs, Győr), then CEE (SK, RO)

---

## How to use this doc

- When starting a plan, set its row to 🟡 and link the PR/branch.
- When a plan ships, set it to ✅ and confirm the commit is referenced in git history.
- New work starts as a dated plan in [`docs/plans/`](plans/), then gets a row here.
