# Code Organization Refactor

**Status:** Draft · **Date:** 2026-05-13

A plan to clean up the mixing of data access, business logic, and HTTP
concerns that has accumulated as we shipped phases 1–7. Survey of the
current state lives at the end of this doc; this opening is the target
architecture and the migration path.

---

## 1. Target Layering

```
┌─────────────────────────────────────────────────────────────────┐
│  HTTP / RSC layer                                               │
│  src/app/api/**/route.ts, src/app/[locale]/**/page.tsx          │
│  Responsibility: parse input, gate auth, call services,         │
│                  shape response.                                │
│  May NOT: import prisma directly.                               │
├─────────────────────────────────────────────────────────────────┤
│  Service / business-logic layer                                 │
│  src/lib/<domain>/<service>.ts (e.g. lib/marketplace/bidding)   │
│  Responsibility: orchestrate, validate, enforce invariants,     │
│                  decide outcomes, fire cross-cutting events     │
│                  (audit, notify).                               │
│  May NOT: import prisma directly. Calls DAL.                    │
├─────────────────────────────────────────────────────────────────┤
│  Data Access Layer (DAL)                                        │
│  src/lib/<domain>/dal.ts (e.g. lib/marketplace/dal.ts)          │
│  Responsibility: own prisma calls for the domain. Returns       │
│                  domain types (NOT prisma types). Enforces      │
│                  tenant scoping (buildingId / orgId) at every   │
│                  query.                                         │
│  May import: prisma, type-mappers.                              │
│  May NOT: import service/route/RSC code.                        │
├─────────────────────────────────────────────────────────────────┤
│  Infra & utilities (cross-cutting, no layer)                    │
│  auth, storage, queue, email, audit, notifications, rbac,       │
│  feature-gate, rate-limit, frozen-check, plan-limits.           │
│  May be imported from any layer above.                          │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** a layer may only call the layer below it, plus
the side-band infra column. No upward calls. No cross-domain reach-
through: `lib/voting/*` may not import `lib/finance/*`, and services
do not import other domains' services. Cross-domain coordination
happens at the HTTP/RSC layer — routes are allowed to call multiple
services and stitch the result. The side-band infra column (audit,
notify, etc.) is the other escape hatch.

**Concrete folder layout per domain:**
```
src/lib/<domain>/
  dal.ts          ← prisma queries
  <service>.ts    ← business logic (one file per use case cluster)
  types.ts        ← domain DTOs
  errors.ts       ← typed errors thrown by services
  index.ts        ← re-exports the public surface
```

The HTTP/RSC layer imports `<domain>` (i.e. its `index.ts`), never
`<domain>/dal`. The lint rule below enforces this.

**Reads vs. writes through `index.ts`:** writes always go through a
service function (validation, audit, notify, invariants). Read-only
queries with no orchestration may be re-exported verbatim from the
DAL by `index.ts` — no hand-written pass-through wrapper. From the
caller's perspective the import surface is the same
(`import { listWonBids } from "@/lib/marketplace"`); the layering rule
stays literally true and lint stays simple.

---

## 2. What's Broken Today (and Why)

A medium-thoroughness survey across 14,957 LOC in `src/lib/`,
125 API routes, and the `[locale]` server components turned up
seven concrete problems, ranked by leverage:

| # | Problem | Worst examples | Why it hurts |
|---|---------|----------------|--------------|
| 1 | **Marketplace has no DAL.** Prisma queries live inside the service files. | `bidding.ts` (8 calls), `publishing.ts` (6), `messaging.ts` (3), `trust.ts` (1), `pricing.ts` (2). | Logic and queries are conjoined → hard to swap stores, hard to unit-test logic, route handlers ALSO hit prisma for marketplace tables. |
| 2 | **API routes embed prisma queries inline.** | `stripe/webhook` (466 LOC, 8+ prisma calls), `finance/ledger` (276, 5+), `maintenance/tickets/[id]` (200+, 4+), `complaints` (257), `reports/generate` (277), `settings` (182). | Route handlers become the de-facto service layer; tenant scoping is repeated in every handler; the same join logic is re-written across routes. |
| 3 | **Server components fetch directly from prisma.** | `contractor/projects/page.tsx`, `contractor/projects/[bidId]/page.tsx`, `maintenance/[id]/page.tsx` (recently added invoice query), `communication/page.tsx`. | RSCs become a third data-access surface alongside DALs and route handlers — the same query gets written three different ways with three different scoping rules. |
| 4 | **Audit logging is scattered.** | 84 separate `createAuditLog({...}).catch(() => undefined)` calls. | Easy to forget. Easy to log inconsistently. No single source of truth for "which actions are auditable." Catch-and-swallow hides delivery failures. |
| 5 | **Notifications are clean at the lib level but scattered at fire sites.** | 15+ call sites: routes for complaints, voting, maintenance, marketplace, invoices. | Same as audit — easy to forget. A new service flow has no checklist for "what should I notify?" |
| 6 | **Feature gating is inconsistent.** | `voting`, `maintenance`, `finance` gate. `complaints`, `announcements` don't. | Plan enforcement leaks. New routes don't know whether they're meant to gate. |
| 7 | **Multi-tenant scoping enforced at the DAL on the condo side, at the route on the contractor side.** | DALs (residents, voting, finance, maintenance, documents) reliably guard `buildingId`. Contractor routes call `requireContractor()` then write `where: { bidderId: orgId }` by hand. | The contractor surface is the leakiest place — one missed filter and you've crossed tenants. |

---

## 3. Migration Phases

Don't big-bang this. The codebase is shipping. Each phase below is a
self-contained PR (or small PR series) with clear stop conditions.

### Phase 0 — Establish a test safety net **(blocking prerequisite)**

**Why first:** the repo today has 334 lines of test code total —
one Vitest file covering `rbac` (121 lines) plus three Playwright
e2e specs (auth, maintenance, voting). The areas this refactor
touches — marketplace, contractor, billing, audit/notify — have
**zero unit coverage**. Refactoring on that base means every
change is a leap of faith.

The fix isn't full coverage. It's **characterization tests**: lock
in current behavior so the refactor's job is "make all these still
pass." Don't ship Phase A until this is green.

**Tenant isolation is the load-bearing property.** Problem #7 (the
contractor surface enforces `orgId` ad-hoc at routes) is the
single most likely thing to regress when Phase C reshapes that
surface. Rather than carve out a separate "isolation suite," the
property is woven into every Phase 0 test that touches org-scoped
data — see "Setup needed" below.

**Priority order (by blast radius if regressed):**

| # | Subject | Why | ~Tests |
|---|---------|-----|--------|
| 1 | Stripe webhook handlers | Bills real money, no rollback. One per event type, assert resulting DB state. | 6–10 |
| 2 | `awardBid` + award route | Transactional, multi-table, fires emails + notifications. Covers ok, no-bids, already-awarded, loser-reason-required. | 4 |
| 3 | Bid create/update flow | Quota enforcement, plan caps, specialty match, org-not-active, idempotent re-submit. | 6 |
| 4 | Ticket status transitions | Forward-only `isValidTransition` rule, contractor status route (`ASSIGNED→IN_PROGRESS→COMPLETED→VERIFIED`). | 5 |
| 5 | Invoice flow | Upload requires COMPLETED; file validation; PAID is locked; mark-paid advances to VERIFIED. | 4 |
| 6 | `notify` routing | Matrix filter; dual-write to `userId` vs `contractorUserId`; both fire correctly. | 3 |

**Pattern:** Vitest with a real test database (transaction rollback
per test). **Do not mock prisma** — it hides exactly the bugs
this refactor is most likely to introduce (forgotten `where`
clauses, missing org filter, dropped tenant scoping).

**Setup needed:**
1. `vitest.config.ts` with a `setupFiles` that points at a test DB
   (separate Postgres schema or container).
2. Per-test transaction wrapper: open a transaction, run the test,
   roll back. Lets tests be parallel-safe without seeding cleanup.
3. A small fixture factory (`makeContractorOrg`, `makePublication`,
   `makeWonBid`, etc.) — saves boilerplate across the ~30 tests.
4. **Paired-tenant fixtures.** Any org-scoped factory yields a
   sibling "other org" alongside the primary
   (`makeContractorOrg()` returns `{ org, otherOrg }`,
   `makeBuilding()` returns `{ building, otherBuilding }`). Every
   Phase 0 test that reads or writes org/building-scoped data
   includes a closing assertion that the *other* tenant sees
   nothing (or gets 403). This makes cross-tenant isolation an
   always-on property of the test suite rather than a discrete
   subject in the priority table — and is the single most
   important guarantee for Phase C.
5. **Stripe webhook fixturing.** Per-event-type payloads are
   checked into the repo as JSON. A small test helper signs them
   with a test-only `STRIPE_WEBHOOK_SECRET` (per-env value, never
   the production secret). The route's real `constructEvent()`
   runs unchanged in tests — the signature-verification path is
   covered, not bypassed. No `stripe-mock` process needed.

**Skip for now:**
- Pure DAL tests — DALs are thin pass-throughs; the integration
  tests above already exercise them.
- Fit-scoring / phrase-bank — pure computation, easy to add later.
- UI snapshot tests — too brittle; the e2e specs already cover
  the critical UI paths.

**Estimated effort:** roughly 1.5–2 weeks of focused work, split:

- **Infrastructure (~2–3 days):** vitest config + test DB
  (container or schema) + prisma migrate flow + CI wiring;
  per-test transaction-rollback wrapper (Prisma's interactive
  transactions require injecting a tx-scoped client into code
  under test — not trivial first time); 5–8 fixture factories;
  paired-tenant fixture pattern; Stripe signing helper + payloads.
- **Test writing (~4–5 days):** ~30 tests across the six priority
  modules above, with cross-tenant assertions woven through any
  test that touches org/building-scoped data.

The 3 existing Playwright specs stay as the cross-stack safety net.
Don't budget Phase 0 as "a couple days" — infrastructure is real
work and lands once. Subsequent test additions amortize cheaply.

**Stop condition:** all 6 priority areas above have at least the
"smoke" test asserting the happy path + one negative path. CI runs
them on every push.

**Exit criteria checklist:**
- [x] `npm test` runs more than the rbac test (50 tests across 8 files)
- [x] Coverage on the 6 priority modules > 0 (10 + 4 + 6 + 5 + 4 + 3 = 32
      characterization tests across the priority surfaces)
- [ ] CI fails the build on test failure — **deferred**; no GitHub
      workflow exists yet, documented in `tests/README.md`
- [x] Fixture factory exists and is used by ≥ 3 test files (used by 7)

**Important — coverage is NOT comprehensive.** Phase 0's tests cover the
six highest-blast-radius surfaces, not "every domain." Each later phase
brings its own coverage gap; see the "Coverage prerequisite" line on
each phase below and the gating policy at the end of §3.

---

### Phase A — Introduce the marketplace DAL **(highest leverage, lowest risk)**

**Why first:** marketplace is the newest, smallest, and most-coupled
domain. Writing its DAL first creates the template for the rest.

**Coverage prerequisite:** acceptable on Phase 0's existing tests.
`awardBid` and `createOrUpdateBid` are characterized (10 tests).
`publishing.ts`, `messaging.ts`, `trust.ts`, `pricing.ts`,
`fit-scoring`, `phrase-bank`, `median` get refactored without
per-function tests — accept the risk. If a test would have caught
something the refactor breaks, add it as you go.

**Steps:**
1. Create `src/lib/marketplace/dal.ts` with one named-export per query.
   Start with what's already in `bidding.ts` / `publishing.ts` /
   `messaging.ts` — straight extract, no logic change.
2. Convert each service file in `lib/marketplace/` to call the DAL
   instead of prisma. `bidding.ts` becomes pure validation + orchestration.
3. Add `src/lib/marketplace/index.ts` re-exporting only the service
   surface. **Do not export the DAL** from `index.ts`.
4. Grep API routes under `src/app/api/contractor/` and
   `src/app/api/marketplace/` for direct prisma calls on marketplace
   tables. Move each to the DAL.
5. **Stop condition:** no `prisma.marketplace*` outside `lib/marketplace/dal.ts`.

**Exit criteria checklist:**
- [ ] `grep -r "prisma\\.\\(marketplaceBid\\|marketplacePublication\\|marketplaceMessage\\|marketplaceInvoice\\|marketplaceFitScore\\)" src/app/` returns 0
- [ ] `grep -r "prisma\\." src/lib/marketplace/ | grep -v dal.ts` returns 0

**Approx. size:** ~600 LOC moved, no behavior change.

---

### Phase B — Drain server-component prisma calls

**Why second:** the contractor pages we just shipped are the worst
offenders, and Phase A's DAL is the natural target.

**Coverage prerequisite:** before moving an RSC's prisma query into a
DAL function, add a smoke test asserting the DAL function returns the
shape the page actually consumes. ~5 tests (one per page touched). RSC
shape regressions otherwise only surface when a user opens the page.

**Steps:**
1. For each `page.tsx` under `src/app/[locale]/` that imports prisma:
   move the query into the matching domain's DAL, and have the page
   call it.
2. Specific targets (callers import from `@/lib/<domain>`; the read
   functions are re-exported from `dal.ts` by `index.ts` — no
   pass-through service wrappers):
   - `contractor/projects/page.tsx` → `listWonBids(orgId)` from `@/lib/marketplace`
   - `contractor/projects/[bidId]/page.tsx` → `getWonBidWithProject(bidId, orgId)` from `@/lib/marketplace`
   - `contractor/marketplace/[id]/page.tsx` → already calls a lib;
     fold the won-bid redirect query into the DAL and re-export it.
   - `maintenance/[id]/page.tsx` invoice query → `getInvoiceForTicket(ticketId)` from `@/lib/marketplace`
   - `communication/page.tsx` emergency-button count → existing DAL re-export.
3. **Stop condition:** zero `prisma.` imports in any `[locale]/**/page.tsx`.

**Approx. size:** ~150 LOC moved.

---

### Phase C — Carve out a contractor DAL + standardize org scoping

**Why third:** problem #7. The contractor surface enforces tenancy
inline ("`where: { bidderId: orgId }`") rather than at a boundary.

**Coverage prerequisite — strict (do not skip):** Phase 0 covers
exactly one contractor surface cross-tenant (the status route). This
phase reshapes ~5 more (`ContractorOrg`, `ContractorUser`,
`ContractorDocument`, `ContractorRating`, projects/profile routes).
Before refactoring each surface, add at least one cross-tenant
negative test using the paired-tenant fixture pattern
(`{ org, otherOrg }` → asserting `otherOrg` gets 404 or empty). Target:
~5 added tests. **This is the highest-risk phase by tenant-isolation
blast radius — the test gate is non-negotiable.**

**Steps:**
1. Create `src/lib/contractor/dal.ts`. Wrap every contractor-facing
   read/write that filters by `orgId`. Every function takes `orgId` as
   its first param — name them so the caller can't forget.
2. Move the `requireContractor()` → call into each route, but the
   route no longer writes `where` clauses. It hands `orgId` to the DAL.
3. Same treatment for `ContractorUser`, `ContractorOrg`,
   `ContractorDocument`, `ContractorRating`.
4. **Stop condition:** every prisma call inside `src/app/api/contractor/`
   has been replaced by a DAL call.

**Approx. size:** ~300 LOC moved + audit of org-scoping correctness.

---

### Phase D — Extract a webhook / billing service

**Why fourth:** problem #2's biggest offender. The Stripe webhook
(466 LOC) is currently a monolith with prisma writes for subscription
state inline.

**Coverage prerequisite:** ship on Phase 0's existing tests. All five
Stripe event types + signature handling + downgrade-freeze are
characterized (10 tests). One known untested edge: the lazy
trial-expiry branch in `getEffectivePlan` — add a test if the refactor
moves that logic into the new billing DAL.

**Steps:**
1. Create `src/lib/billing/`:
   - `dal.ts` — prisma queries for `Subscription`, `Building.plan`,
     `ContractorOrg.plan`.
   - `webhook-handlers.ts` — one function per Stripe event type.
   - `plans.ts` — already exists, keep.
2. The webhook route shrinks to: verify signature → dispatch by event
   type → call handler → ack.
3. **Stop condition:** webhook route under 100 LOC.

**Approx. size:** ~400 LOC moved.

---

### Phase E — Sweep legacy audit + notify call sites into services

**Note on framing:** the rule "services own audit + notify" is a
convention (§4 #4), applied to all new service code from day one —
not gated on this phase. Phases A/C/D author services that already
follow the rule. Phase E is purely the cleanup of *pre-existing*
scattered call sites in legacy code paths. It can run in parallel
with, before, or after any other phase — it is not a sequencing
dependency.

**Why it exists:** problems #4 and #5. 84 audit and 15 notify call
sites live in routes today. Until they move, the convention applies
to new code only and the legacy code drifts.

**Coverage prerequisite:** Phase 0's `notify-routing.test.ts` proves
the `notify` function works (matrix filter + dual-write). It does
**not** prove that any given flow still *calls* it. Risk: a Phase E
PR moves an audit/notify call out of a route into a service and
silently drops it. Mitigation: when moving a call site, add an
assertion to whichever priority-module test already exercises that
flow (e.g. when moving the bid-awarded notify into a service, the
`award-bid.test.ts` happy-path test grows an assertion that a
Notification row was created). Don't accept a "moved it" PR without
an accompanying "still happens" assertion.

**Steps:**
1. Walk through the existing 84 audit-log call sites: for each, either
   move it down into a service function, or add it to
   `src/lib/audit/exceptions.md` with a one-line justification.
2. Same for the 15 notify call sites.
3. Wrap both with thin helpers in each domain:
   `marketplaceEvents.bidWasAwarded({...})` does the audit + notify
   in one place per event.
4. **Stop condition:** `grep -r "createAuditLog\\|notify(" src/app/api/`
   shows only entries that appear in the exceptions list.

**Approx. size:** no LOC move, but a real conceptual cleanup.

---

### Phase F — Finance / Complaints / Maintenance route slimming

**Why last:** these are the largest individual routes, but they're
not in the critical path of shipping new features (marketplace and
contractor are). Tackle once the pattern is established.

**Coverage prerequisite — strict:** Phase 0 covered **none** of these
routes. Each big route (`finance/ledger` 276 LOC, `finance/charges`,
`finance/budget`, `complaints` 257 LOC, `complaints/[id]`,
`reports/generate` 277 LOC, `maintenance/tickets/[id]` 200+ LOC,
`settings`) needs ground-up characterization tests **before** its
slim-down. Target: ~3–5 tests per route, focused on the happy path +
one error path + (for any building/org-scoped route) a paired-tenant
cross-tenant assertion. This is "refactor without a net" territory if
skipped — the routes are large, the logic is unaudited, and a quiet
behavior change here ships straight to users.

**Steps:** same playbook as Phase A. Each becomes one DAL +
service + thin route.

---

### Coverage gating policy

Phase 0 does **not** cover every domain — it covers the six surfaces
with the highest blast radius if regressed. Each later phase brings
its own coverage debt; the per-phase "Coverage prerequisite" line
above states whether existing tests are sufficient or new ones must
land first.

The principle: **if a phase makes a behavior load-bearing in a new
place, that behavior needs a test before the phase ships, not after.**

Net additional tests this policy implies (rough): Phase A ~0, Phase B
~5, Phase C ~5, Phase D ~0–1, Phase E grows existing tests rather than
adding files, Phase F ~20–30 spread across the big routes. Total
~30–40 added tests by the time the refactor closes — taking the
suite from 50 to ~80–90.

What the policy is **not**: it is not a mandate to backfill coverage
on untouched domains (voting, communication, documents, residents,
units, profile, 2FA, sessions, reports, self-serve registration). The
refactor doesn't touch them; they don't need new tests for the
refactor to ship safely. They remain coverage debt for the codebase
overall — out of scope here.

---

## 4. Conventions to Lock It In

Once the layers are in place, prevent regression with cheap rules:

1. **ESLint rule:** `no-restricted-imports` on the `prisma` package
   inside `src/app/**`. Make the lint a hard error. Routes and pages
   physically cannot import prisma.
2. **ESLint rule:** `no-restricted-imports` on `**/dal.ts` from
   outside its own domain folder. DALs are domain-internal.
3. **Naming:** every domain lives under `src/lib/<domain>/` with
   `dal.ts` for data access and `<service>.ts` (or unsuffixed) for
   business logic. The flat `lib/<domain>-dal.ts` shape is a legacy
   start-state artifact — the end state has no flat DALs.
4. **Services own audit + notify.** Routes and RSCs do not call
   `createAuditLog` or `notify(...)` directly. The service function
   that performs the action fires the audit log and the notification.
   Documented exceptions (failed-auth audit, rate-limit hits — i.e.
   things that happen *before* a service is reached) live on a short
   list in `src/lib/audit/exceptions.md`. This applies to all new
   service code from day one — it is not a phase-gated rule.
5. **Narrow shapes via `select`.** DALs use Prisma `select` (or
   `include` with selects) to return narrow shapes, never raw
   entities. The inferred return type is the DTO — hand-written
   DTO types and mapping functions are not required. If a shape
   is reused across DAL functions, lift the `select` clause into
   a `const` and export the inferred type. The real win is
   forcing each field to be explicitly listed so internal columns
   (`riskScore`, `internalNote`, etc.) don't leak to the client by
   default — not storage-engine abstraction.
6. **Tests:** Phase 0 establishes the characterization-test baseline
   (real DB, no prisma mocks). Once services are extracted from the
   prisma calls, additional unit tests can mock the DAL where useful
   — but the Phase 0 characterization layer remains the load-bearing
   safety net.
7. **Feature gates:** every new write route must declare its
   `requireFeature(...)` call in the first 10 lines, or explicitly
   note `// feature: free` if intentional. Code review check, not
   lint — too many false positives for read routes.

---

## 5. What This Buys Us

- **Testability.** Service files become unit-testable without
  spinning up Postgres. The DAL gets integration-tested separately.
- **One-place-to-look.** A new dev asking "where does a bid get
  awarded?" finds `lib/marketplace/awarding.ts`, not a 200-line
  route handler with prisma queries.
- **Tenancy safety.** All marketplace queries scoped by `orgId` /
  `buildingId` at one boundary. Today the contractor surface
  scatters this across routes and is the most likely place to
  leak across tenants.
- **Storage churn is contained.** When prisma column renames or
  query rewrites happen, they ripple inside the DAL, not across
  routes and RSCs. (Not a claim of full storage-engine
  abstraction — that would require hand-written DTOs and isn't
  what this refactor delivers.)
- **Audit + notification completeness.** Once these fire from the
  service layer rather than per-route, a new flow can't silently
  forget to log or notify.

---

## 6. Non-Goals

- **No standalone file-move PRs for symmetry.** The end state is
  uniform — every domain in `lib/<domain>/dal.ts` shape — but we
  don't open a PR whose only purpose is relocating flat DALs.
  Each flat DAL (`lib/voting-dal.ts`, `maintenance-dal.ts`, etc.)
  moves to the folder shape as a side effect of the first phase
  that touches its domain. By the time the refactor closes, no
  flat DALs remain.
- **Not changing the prisma schema.** This is a code-organization
  refactor, not a model refactor.
- **Not introducing a new DI container or "clean architecture"
  framework.** Plain TypeScript modules + the ESLint rules above
  are enough.
- **Not introducing an event bus or transactional outbox.**
  Cross-domain workflows (e.g. "award a bid → advance the
  maintenance ticket → notify") are composed at the route layer
  by calling multiple services in sequence. Partial-failure
  recovery — service A commits, service B fails — remains the
  caller's responsibility, same as today. Worth revisiting if
  the cross-domain workflow count grows past a handful.
- **Not rewriting tests we don't have.** The first thing that gets
  added per service is a small smoke test, not a full suite.

---

## 7. Survey Snapshot (Pre-Refactor)

A medium-thoroughness scan on 2026-05-13 found:

- **`src/lib/`** — ~15 kLOC. DALs solid for condo domains (residents,
  voting, finance, maintenance, documents). Marketplace has none —
  prisma queries live inside service files (`bidding.ts`,
  `publishing.ts`, `messaging.ts`, `trust.ts`, `pricing.ts`).
- **`src/app/api/`** — 125 routes. ~40% embed prisma directly.
  Biggest offenders: `stripe/webhook` (466), `finance/ledger` (276),
  `reports/generate` (277), `complaints` (257), `maintenance/tickets/[id]` (200+).
- **`src/app/[locale]/`** — server components are mostly clean on
  the condo side. The contractor pages and the recently-added
  maintenance invoice query are the leaks (~5 files).
- **Cross-cutting:** `requireBuildingContext` + DAL enforcement is
  the right pattern, applied consistently on the condo side.
  Contractor scoping is enforced ad-hoc at the route layer.
  `createAuditLog` is called from 84 places. `notify` from 15.
  Feature-gating is per-route and inconsistent.
- **Marketplace notifications** were extended in Phase 5/6 to support
  contractor recipients — that's clean code that landed correctly,
  but it's a one-off; the deeper organization issues above are
  what this refactor addresses.
- **Test coverage:** 334 lines total. One Vitest unit file covering
  `rbac` (121 lines), plus three Playwright e2e specs (auth 49,
  maintenance 75, voting 89). **Zero unit coverage** on marketplace,
  contractor, billing, audit, notifications, finance, or complaints —
  i.e. exactly the surfaces this refactor touches. This is why
  Phase 0 exists.

---

## 8. Open Questions

- Are we OK with one DAL file per domain (e.g. `marketplace/dal.ts`)
  or do we want one file per aggregate (`marketplace/bid-dal.ts`,
  `marketplace/publication-dal.ts`)? Recommendation: start with one,
  split if it crosses ~800 LOC.
- Do we want to introduce typed errors per service (`BidError`,
  `BillingError`) or stick with the current pattern of returning
  `{ ok: false, reason: "..." }` discriminators? Recommendation:
  keep the discriminator pattern — it's already established and
  surfaces nicely in route → client error mapping.
