# Condo Manager — Roadmap

Single source of truth for what's shipped, what's in progress, and what's planned.
This is a living document — update the status column when a plan moves.

- **Detailed build plans:** [`docs/plans/`](plans/)
- **Module map:** [`docs/modules-overview.md`](modules-overview.md)
- **Commercial plan:** [`docs/business-plan/business-plan-2026-04.md`](business-plan/business-plan-2026-04.md)

_Last updated: 2026-06-23 — added superadmin feature-management console_

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
| ✅ | Real-time pub/sub + worker queue | [real-time-infrastructure](plans/2026-04-28-real-time-infrastructure.md) |
| ✅ | Server-side PDF reporting (version hashing) | [pdf-reporting](plans/2026-04-28-pdf-reporting.md) |
| ✅ | Audit log UI + export | [audit-ui-and-export](plans/2026-04-28-audit-ui-and-export.md) |
| ✅ | Hungarian condo-law alignment (phases 1–5, cameras, GDPR) | [roles-legal-alignment](plans/2026-04-27-roles-legal-alignment.md) |
| 🟡 | Mobile / responsive (baseline shipped; polish ongoing) | [mobile-responsive](plans/2026-05-18-mobile-responsive.md) |

### Planned / in progress

| Status | Item | Notes | Plan |
|--------|------|-------|------|
| 🟡 | **Feature-gating enforcement** | `feature-gate.ts` exists; remaining: typed feature taxonomy, lock tier names (Kezdő/Képviselő/Kezelő iroda), HUF pricing, hard plan-limit caps | [feature-gating-enforcement](plans/2026-04-28-feature-gating-enforcement.md) |
| ⬜ | **Superadmin feature-management console** | DB-driven feature catalog (plan↔feature matrix), per-building overrides, global feature flags, plan limits/pricing editing. Supersedes the code-based feature map; lets superadmin change access with no deploy. | [superadmin-feature-management](plans/2026-06-23-superadmin-feature-management.md) |
| ⬜ | **Banking integrations** | Biggest open item. 5 phases: CSV import → bank-specific parsers (OTP/K&H/Erste/Raiffeisen) → reconciliation engine → MT940/CAMT.053 → PSD2 aggregator. Required to make *"élő bankszinkron"* claim truthful; gates the premium tier. | [banking-integrations-research](plans/2026-04-28-banking-integrations-research.md) |

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
