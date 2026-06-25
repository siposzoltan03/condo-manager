# Condo Manager — Modules Overview

High-level map of the product's feature modules. Each entry links to the detailed implementation plan (step-by-step build checklist) and, where available, the Stitch UI reference.

Routes are under `src/app/[locale]/<route>/` and APIs under `src/app/api/<route>/` unless noted.

---

## Core Platform

### Multi-Building Foundation
Users belong to one or more buildings with per-building roles; units link residents to buildings.
- **Plan:** [docs/plans/2026-03-28-multi-building-migration.md](plans/2026-03-28-multi-building-migration.md)
- **Spec:** [docs/specs/2026-03-28-multi-building-migration.md](specs/2026-03-28-multi-building-migration.md)
- **Entities:** `Building`, `UserBuilding`, `UnitUser`
- **Notes:** Four-phase non-breaking migration (add tables → migrate data → update code → drop old columns).

### Unit Management
Admins create/edit units and set ownership shares (drive voting weights).
- **Plan:** [docs/plans/2026-03-31-unit-management.md](plans/2026-03-31-unit-management.md)
- **Route:** `/units`
- **Notes:** Ownership share 0–100% per unit; totals per building should sum to 100%.

### Subscriptions & Feature Gating
Subscription/plan models, invitation flow, and feature-gating throughout the app.
- **Plan:** [docs/plans/2026-03-30-subscriptions-schema-invitations-gating.md](plans/2026-03-30-subscriptions-schema-invitations-gating.md)
- **Spec:** [docs/superpowers/specs/2026-03-30-subscription-plans-and-invitations-design.md](superpowers/specs/2026-03-30-subscription-plans-and-invitations-design.md)
- **API:** `/api/plans`, `/api/subscription`, `/api/invitations`
- **Notes:** `Subscription` entity owns buildings + Stripe customer. Gating via `requireFeature()` at API and disabled UI items at presentation. Invitation tokens are SHA-256 hashed.

### Stripe Billing
Subscription checkout, webhook handling, customer portal.
- **Plan:** [docs/plans/2026-03-30-stripe-integration-billing.md](plans/2026-03-30-stripe-integration-billing.md)
- **API:** `/api/stripe`
- **Notes:** Synchronous verify-session endpoint provisions the subscription immediately after checkout (avoids webhook delay); webhooks are idempotent.

### Public Pages (Marketing)
Landing, pricing comparison, checkout entry.
- **Plan:** [docs/plans/2026-03-30-public-pages-landing-pricing.md](plans/2026-03-30-public-pages-landing-pricing.md)
- **Routes:** `/`, `/pricing`, `/checkout`
- **Notes:** Public pages bypass auth middleware; pricing fetched from DB via public API.

---

## Feature Modules

### Communication & Collaboration
Announcements, forum topics, direct messaging, formal complaints.
- **Plan:** [docs/plans/2026-03-25-condo-manager-communication.md](plans/2026-03-25-condo-manager-communication.md)
- **UI refs:** [announcements](reference/stitch-announcements-design.md), [forum](reference/stitch-forum-design.md), [messaging](reference/stitch-messaging-design.md), [complaints](reference/stitch-complaints-design.md)
- **Routes:** `/announcements`, `/forum`, `/messages`, `/complaints`, `/notifications`
- **Notes:** Every mutation triggers the notification engine and audit logging.

### Finance
Double-entry ledger, unit charges, building budgets, expense tracking.
- **Plan:** [docs/plans/2026-03-26-condo-manager-finance.md](plans/2026-03-26-condo-manager-finance.md)
- **UI refs:** [unit payment](reference/stitch-unit-payment-design.md), [building budget](reference/stitch-building-budget-design.md)
- **Route:** `/finance` (+ `/finance/building`)
- **Notes:** `Account` / `LedgerEntry` models; monthly payment status per unit; CSV bank statement import + PDF invoice generation.

### Maintenance
Resident-reported issues with board-managed workflow and contractor assignment.
- **Plan:** [docs/plans/2026-03-27-condo-manager-maintenance.md](plans/2026-03-27-condo-manager-maintenance.md)
- **UI ref:** [maintenance](reference/stitch-maintenance-design.md)
- **Route:** `/maintenance` (+ `/maintenance/contractors`, `/maintenance/scheduled`)
- **Notes:** State machine Submitted → Completed → Verified; urgency/category drives triage.

### Documents
Categorized storage with versioning, role-based visibility, async text extraction.
- **Plan:** [docs/plans/2026-03-28-condo-manager-documents.md](plans/2026-03-28-condo-manager-documents.md)
- **UI ref:** [documents](reference/stitch-documents-design.md)
- **Route:** `/documents`
- **Notes:** Self-referencing `DocumentCategory` tree; visibility `PUBLIC`/`BOARD`/`ADMIN`; `extractedText` field prepared for BullMQ-driven full-text search.

### Voting & Meetings
Share-weighted governance votes, secret ballots, quorum tracking, meeting RSVP, minutes.
- **Plan:** [docs/plans/2026-03-28-condo-manager-voting.md](plans/2026-03-28-condo-manager-voting.md)
- **UI ref:** [voting](reference/stitch-voting-design.md)
- **Route:** `/voting`
- **Notes:** Ballot weight = unit ownership share. Secret ballots store no `userId`, return receipt hash. BullMQ delayed job auto-closes at deadline.

---

## Infrastructure & Admin

- **Admin panel** — `/admin` (buildings, users); APIs `/api/admin`, `/api/buildings`, `/api/users`
- **Audit logs** — `/api/audit-logs`
- **Auth** — `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`; API `/api/auth`
- **Push notifications** — `/api/push`
- **Settings** — `/settings` (billing, invitations)
- **Health** — `/api/health`

---

## Cross-Cutting Concerns

- **Background jobs:** BullMQ workers for vote auto-close, document text extraction, scheduled maintenance.
- **i18n:** next-intl; routes nested under `[locale]`.
- **Audit:** mutations in feature modules write to the audit log.
- **Ongoing refactor:** [docs/plans/2026-04-01-nextjs-app-router-refactoring.md](plans/2026-04-01-nextjs-app-router-refactoring.md) — migration toward Next.js App Router patterns.
