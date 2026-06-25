# Contractor Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Közös to contractors as a second-side audience. Contractors sign up, list their specialties and region, and bid on `MaintenanceTicket`s that condos publish to a marketplace board. Condos get a vetted pool of providers without paying for contractor acquisition; contractors get qualified leads without paying for marketing. The platform monetises both sides.

**Architecture:** Two-sided role tree. Condo side keeps its existing `UserBuilding` membership model. Contractor side is a new top-level `ContractorOrg → ContractorUser` tree that operates across many condos, never tied to a specific building. Marketplace publishing is opt-in per ticket. Privacy boundary enforced at the marketplace listing service: pre-award, contractors see scrubbed metadata only (city/zip, category, urgency, budget band, description). Post-award, the winning contractor sees full address + a board contact. Bidding is structured (price + ETA), not free-form.

**Tech Stack:** Next.js 15 App Router with a second auth surface (`/contractor/*`), Prisma, BullMQ for lead notifications, Stripe for contractor-side billing. Re-uses the existing email + push notification pipelines.

**Spec source:** Brainstorm session 2026-05-11; design walkthrough 2026-05-11. Cross-references: `docs/plans/2026-03-30-stripe-integration-billing.md` (billing patterns), `docs/plans/2026-03-30-subscriptions-schema-invitations-gating.md` (feature-gate shape), `docs/plans/2026-03-27-condo-manager-maintenance.md` (existing ticket model).

**Non-goals:**
- Native mobile app for contractors — web-only at launch.
- Escrow / platform-held payments — money flows directly between condo and contractor; we don't touch it.
- Insurance / liability brokering — out of scope; we surface contractor-uploaded insurance docs only.
- Automated dispatch (auto-award lowest bid) — the board always picks manually; the best-fit ranker (Phase 5) is advisory only and rule-based, not LLM-driven.
- Multi-country expansion — HU only at launch (NAV invoice format, magyar copy).
- Mass-import of historical contractor data — Phase 1 absorbs existing `Contractor` directory rows as "legacy" profiles, not active marketplace members.
- Free-form rich text or attachments in anonymous messaging — Phase 5 messaging is plain-text only.

> **2026-05-11 design-handoff revisions:**
> 1. In-app anonymous messaging between board and contractor pre-award **is in scope** (Phase 5). The "no in-app messaging" non-goal from the brainstorm has been retired.
> 2. Best-fit bid ranking **is in scope** (Phase 5) as an advisory layer on the bid review page. Implemented as a deterministic weighted-sum over first-party data — no LLM tokens, no external ML service. Marketing copy may call it "Közös AI · best-fit"; engineering treats it as a rule-based ranker. The earlier "no AI scoring" non-goal has been retired in that narrow sense.
> 3. Pricing tier shape switched from capacity caps to per-week throughput + specialty/region caps. See `Pricing tiers` below.
> 4. Trial length 14 days (was 30).
> 5. Award notification SLA loosened from 60 s to 5 min in the acceptance criteria.
> 6. 8-month win-or-refund guarantee on paid plans **is in scope** as a marketing commitment.

---

## Legal & Regulatory Anchors

| Concern | Source | Implication |
|---|---|---|
| **GDPR Art. 28** — joint controller / processor between condo (controller of owner data) and contractor (recipient of limited PII for the job) | EU 2016/679 | DPA addendum signed at contractor onboarding; data minimisation at the publish step |
| **DSA — online intermediary rules** | EU 2022/2065 | Notice-and-action for illegal content (e.g. unlicensed contractor), transparent terms, statement of reasons on award rejections |
| **P2B Regulation** | EU 2019/1150 | Transparent ranking criteria, written reason if a contractor is delisted, 30-day notice for terms changes |
| **NAV e-számla** | 2024/Áfa.tv. | Contractor must issue compliant e-invoice to condo after completion — Közös does not generate invoices, but surfaces a NAV-XML upload slot |
| **HU consumer protection** | 2008/XLVII. tv. | Contractor must publish license info, working area, complaints contact |

---

## File Structure — What Changes

```
src/
├── app/
│   ├── (contractor)/                # NEW: contractor-side route group, separate layout
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── marketplace/page.tsx     # the open-job board
│   │   ├── leads/page.tsx           # tickets the contractor has bid on
│   │   ├── projects/page.tsx        # tickets awarded to the contractor
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── contractor/
│   │   │   ├── auth/route.ts
│   │   │   ├── marketplace/route.ts
│   │   │   ├── bids/route.ts
│   │   │   └── profile/route.ts
│   │   └── tickets/[id]/publish/route.ts    # NEW: condo-side publish toggle
│   └── [locale]/maintenance/
│       └── tickets/[id]/bids/page.tsx       # NEW: condo-side bid review
├── components/
│   └── contractor/                  # NEW: contractor-side UI tree
│       ├── shell.tsx
│       ├── marketplace-board.tsx
│       ├── bid-form.tsx
│       └── ...
├── lib/
│   ├── contractor-auth.ts           # NEW: parallel auth surface (or unified)
│   ├── contractor-dal.ts            # NEW: marketplace, bids, leads
│   └── marketplace/
│       ├── publishing.ts            # NEW: scrub PII before listing
│       └── pricing.ts               # NEW: bid quota + plan gates
prisma/
└── schema.prisma                    # MODIFY: ContractorOrg, ContractorUser, MarketplaceBid, etc.
```

---

## Role Model

Two parallel trees that never overlap:

```
Condo side                         Contractor side
├─ SUPER_ADMIN                     ├─ CONTRACTOR_OWNER (full org admin)
├─ ADMIN                           └─ CONTRACTOR_STAFF (view/bid)
├─ BOARD_MEMBER
├─ OWNER
└─ TENANT
```

A single Person (one email) can belong to **either** tree, **not both**, in v1. This avoids RBAC clarity questions ("am I a contractor or a board member right now?"). If a board chair also runs a contractor business, they sign up with a different email.

The existing `User.role` enum stays condo-side. Contractor-side roles live on `ContractorUser.role`. Auth resolves which tree the email belongs to and routes accordingly.

---

## Schema Sketch

```prisma
enum ContractorPlan {
  FREE
  PRO
  PREMIUM
}

enum ContractorOrgStatus {
  PENDING_VERIFICATION   // signed up, not yet KYC-verified
  ACTIVE
  SUSPENDED              // platform moderator action
  DELISTED               // contractor self-deleted account
}

enum ContractorUserRole {
  OWNER
  STAFF
}

model ContractorOrg {
  id              String                  @id @default(cuid())
  name            String
  /// HU tax id (adószám), validated at onboarding.
  taxId           String                  @unique
  /// HU NAV registration confirmation, if available.
  navConfirmedAt  DateTime?
  /// JSON list of specialty slugs ("plumbing", "electrical", "elevator", ...).
  specialties     Json                    @default("[]")
  /// JSON list of HU county/region codes the contractor will travel to.
  regions         Json                    @default("[]")
  /// Public profile.
  description     String?                 @db.Text
  websiteUrl      String?
  logoUrl         String?
  /// Insurance / license docs — file-storage keys, not URLs.
  documents       ContractorDocument[]
  /// Stripe customer for contractor-side billing.
  stripeCustomerId String?                @unique
  plan            ContractorPlan          @default(FREE)
  planStatus      String                  @default("ACTIVE")  // TRIALING/ACTIVE/PAST_DUE/CANCELLED
  status          ContractorOrgStatus     @default(PENDING_VERIFICATION)
  users           ContractorUser[]
  bids            MarketplaceBid[]
  awardedTickets  MaintenanceTicket[]     @relation("AwardedContractor")
  /// One-to-one back-link to the legacy `Contractor` directory row when
  /// a board has worked with this contractor before signing up.
  legacyContractorId String?              @unique
  legacyContractor   Contractor?          @relation(fields: [legacyContractorId], references: [id])
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt
}

model ContractorUser {
  id              String              @id @default(cuid())
  org             ContractorOrg       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  orgId           String
  email           String              @unique
  passwordHash    String
  name            String
  phone           String?
  role            ContractorUserRole  @default(OWNER)
  emailVerifiedAt DateTime?
  isActive        Boolean             @default(true)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([orgId])
}

model ContractorDocument {
  id        String         @id @default(cuid())
  org       ContractorOrg  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  orgId     String
  /// "insurance" | "license" | "reference" | "other"
  kind      String
  storageKey String
  fileName  String
  /// Optional expiry — surfaced to condos as "valid through".
  validUntil DateTime?
  createdAt DateTime       @default(now())

  @@index([orgId, kind])
}

enum MarketplacePublishStatus {
  DRAFT       // condo started a marketplace post but hasn't published
  OPEN        // accepting bids
  AWARDED     // an awarded bid exists, no more bids
  CLOSED      // condo closed without awarding
}

model MarketplacePublication {
  id           String                    @id @default(cuid())
  /// The ticket exposed to the marketplace. Unique because each ticket
  /// can only be published once at a time.
  ticket       MaintenanceTicket         @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  ticketId     String                    @unique
  status       MarketplacePublishStatus  @default(OPEN)
  /// Frozen at publish time — what the board chose to expose. The
  /// listing service NEVER re-reads the ticket after this point.
  scrubbedTitle       String
  scrubbedDescription String                @db.Text
  category     String
  urgency      String
  city         String
  zip          String
  /// Budget hint band — "<100K", "100K-500K", "500K-2M", "2M+".
  budgetBand   String?
  deadlineAt   DateTime?
  /// JSON list of specialty slugs this ticket is open to.
  specialties  Json                       @default("[]")
  publishedAt  DateTime                   @default(now())
  publishedById String                    // condo user who hit publish
  publishedBy  User                       @relation("MarketplacePublisher", fields: [publishedById], references: [id])
  bids         MarketplaceBid[]
  awardedBid   MarketplaceBid?            @relation("AwardedBid", fields: [awardedBidId], references: [id])
  awardedBidId String?                    @unique
  awardedAt    DateTime?
  closedAt     DateTime?

  @@index([status, publishedAt])
  @@index([city])
}

enum MarketplaceBidStatus {
  SUBMITTED
  WITHDRAWN
  REJECTED
  WON
}

model MarketplaceBid {
  id              String                   @id @default(cuid())
  publication     MarketplacePublication   @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  publicationId   String
  bidder          ContractorOrg            @relation(fields: [bidderId], references: [id])
  bidderId        String
  /// Net Ft amount the contractor is quoting.
  amount          Decimal                  @db.Decimal(12, 2)
  /// Estimated days to completion from award.
  etaDays         Int
  /// Bidder's short narrative — limited to plain text, 800 chars.
  notes           String?                  @db.Text
  status          MarketplaceBidStatus     @default(SUBMITTED)
  /// Set when the board awards or rejects this bid.
  decidedAt       DateTime?
  decidedById     String?
  /// Free-text reason — surfaced to the bidder per P2B Art. 4.
  decisionReason  String?                  @db.Text
  /// Awarded counterpart back-link (one row).
  awardedFor      MarketplacePublication?  @relation("AwardedBid")
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  @@unique([publicationId, bidderId])
  @@index([bidderId, status])
}

/// Anonymous board ↔ contractor thread tied to a single publication,
/// scoped to a single bidder. Plain-text only. The board side sees the
/// contractor's display name + trust signals; the contractor side sees
/// "Közös képviselő" (no name) until award. Phase 5 feature.
model MarketplaceMessage {
  id            String                  @id @default(cuid())
  publication   MarketplacePublication  @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  publicationId String
  bidder        ContractorOrg           @relation(fields: [bidderId], references: [id])
  bidderId      String
  /// "BOARD" or "CONTRACTOR" — who sent this message.
  senderSide    String
  /// userId on the condo side OR contractorUserId on the contractor side.
  senderId      String
  body          String                  @db.Text
  readAt        DateTime?
  createdAt     DateTime                @default(now())

  @@index([publicationId, bidderId, createdAt])
}

/// Optional best-fit score cached per (publication, bid) pair (rule-based,
/// no LLM). Computed
/// on the bid-review page render and re-used across the page lifecycle.
/// Advisory only — the board always picks manually. Phase 5 feature.
model MarketplaceFitScore {
  id            String                  @id @default(cuid())
  publication   MarketplacePublication  @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  publicationId String
  bid           MarketplaceBid          @relation(fields: [bidId], references: [id], onDelete: Cascade)
  bidId         String                  @unique
  /// 0–100 composite.
  score         Int
  /// Short narrative shown under the bid card (e.g.
  /// "Ár a sáv közepén, ETA átlag alatt, kerületi szakértelem.").
  rationale     String                  @db.Text
  /// Frozen at compute time so a later display matches the explanation.
  factorsJson   Json
  computedAt    DateTime                @default(now())

  @@index([publicationId, score])
}
```

Plus a foreign key on the existing `MaintenanceTicket`:

```prisma
model MaintenanceTicket {
  // existing fields...
  awardedContractorId  String?
  awardedContractor    ContractorOrg?       @relation("AwardedContractor", fields: [awardedContractorId], references: [id])
  publication          MarketplacePublication?
}
```

---

## Privacy Boundary

The board's "publish to marketplace" action freezes a **scrubbed** snapshot of the ticket onto `MarketplacePublication`. The listing service queries the publication, never the source ticket, so private data can't leak by accident.

| Field | Pre-award | Post-award (winning bidder only) | Notes |
|---|---|---|---|
| Title | scrubbed | original | Board approves the public title at publish |
| Description | scrubbed | original | Same |
| Category | ✓ | ✓ | |
| Urgency | ✓ | ✓ | |
| City + ZIP | ✓ | ✓ | Coarse location |
| Full address | ✗ | ✓ | Surfaced via the award email |
| Building name | ✗ | ✓ | Same |
| Unit number | ✗ | ✓ if relevant to the job | Board picks per-ticket |
| Reporter / owner identity | ✗ | ✗ | Always hidden — communication routes through a board contact |
| Reporter contact | ✗ | board contact only | Single point of contact |
| Budget band | optional | ✓ | Coarse band, not exact |
| Past bids | ✗ | ✗ | Sealed bidding — bidders never see each other |
| Historical median ("avg winning bid") | aggregated | aggregated | Computed across ≥10 past `AWARDED+CLOSED` publications matching the same specialty + city; never exposes in-flight bids |
| Anonymous messages (Phase 5) | bidder ↔ board only | same | Plain-text only; the bidder sees "Közös képviselő" until award; messages purged on rejection |

---

## Pricing tiers

| Plan | Price (Ft/mo) | Bid throughput | Specialties | Regions | Featured ranking | Lead notification | Other |
|---|---|---|---|---|---|---|---|
| **Free** | 0 | 3 / week | 1 | 1 | — | — | NAV-verified badge surfaced; weekly digest email |
| **Pro** | 9 900 | Unlimited | 5 | 5 | — | Email + push, immediate for urgent leads | Document-expiry push, 2 team seats |
| **Premium** | 24 900 | Unlimited | Unlimited | Unlimited | Yes — sorted above Free/Pro | + SMS + dedicated key-account manager (M–P) | API access, Billingo + Számlázz.hu invoicing integration, ad slot in monthly Tiles körlevél, unlimited team seats |

**Trial:** 14 days of Pro on signup. No card required to start.

**Win-or-refund guarantee** (Pro + Premium): if a paid org submits ≥1 bid per month and wins zero jobs in 8 consecutive months, the platform automatically refunds all paid subscription fees for that window. P2B-compliant — surfaced on the public landing page.

**Quota model:** Free is a *throughput* cap (rolling 7 days) rather than a capacity cap, so a contractor can keep an unlimited number of active bids open at once. Specialty and region caps are *profile-level*; changing specialties on Free requires removing an existing one first.

---

## Phase 1: Foundation — schema + auth surface

**Goal:** Provision the schema. Stand up a separate `/contractor/login` + signup surface with inline NAV adószám validation. No marketplace yet, just account creation that lands a `ContractorOrg` row in `PENDING_VERIFICATION`.

- [ ] **Step 1: Schema migration**. Add the nine new models + enums (`ContractorOrg`, `ContractorUser`, `ContractorDocument`, `MarketplacePublication`, `MarketplaceBid`, `MarketplaceMessage`, `MarketplaceFitScore`, plus the four enums). Backfill: existing `Contractor` directory rows stay as-is; new orgs link via `legacyContractorId` when the board has previously worked with them (manual match step, not automated).

- [ ] **Step 2: Auth split**. NextAuth credentials provider extended to look up `ContractorUser` when the login form posts from `/contractor/login`. Two cookies in different paths so a contractor session can't accidentally talk to condo APIs and vice-versa. RBAC middleware asserts `request.path.startsWith("/contractor")` ↔ `session.role === "CONTRACTOR_*"`.

- [ ] **Step 3: Signup endpoint** at `/api/contractor/auth/signup`. Captures email, password, org name, tax ID. Validates tax ID format (HU adószám regex). Sends verification email (re-uses existing `verificationEmail` template with `eyebrowLabel: "Vállalkozó regisztráció"`).

- [ ] **Step 4: Inline NAV validation on the signup form**. The adószám input fires a debounced lookup against the NAV adószám-validation API (free, no auth). On success the field shows "NAV-igazolt ✓ — adófizető magánvállalkozó" and the form unlocks. On failure the field shows a soft warning but doesn't block submission — the org still proceeds to onboarding and an operator can approve manually. Cache results for 24 h to avoid hammering NAV.

- [ ] **Step 5: Empty shell layout** at `src/app/(contractor)/layout.tsx` with the Tiles palette + a "Vállalkozó" wordmark to make the surface visually distinct from the condo side.

- [ ] **Step 6: Migration**
  ```bash
  npx prisma migrate dev --name phase1-contractor-marketplace
  ```

---

## Phase 2: Contractor onboarding

**Goal:** A new contractor signs up and reaches `ACTIVE` status without operator intervention.

- [ ] **Step 1: Onboarding wizard** at `/contractor/onboarding`. Five steps:
  1. Org profile (display name, public description, website)
  2. Specialties (multi-select from a fixed taxonomy)
  3. Service regions (HU counties + Budapest districts)
  4. Documents (insurance, business license — upload via existing storage abstraction; mandatory before going active)
  5. Review + accept DPA + ToS

- [ ] **Step 2: KYC / NAV tax ID validation**. Calls the public NAV adószám-validation API (free, no auth required) to confirm the tax ID resolves to a registered business. Stores the `navConfirmedAt` timestamp; if NAV fails, the org stays in `PENDING_VERIFICATION` and a platform operator must approve manually.

- [ ] **Step 3: Auto-activate** once: all documents uploaded, tax ID NAV-confirmed, DPA + ToS accepted. Flip status → `ACTIVE`. Welcome email (re-uses `welcomeEmail`, customised copy).

- [ ] **Step 4: Settings page** at `/contractor/settings` to edit profile, specialties, regions, documents.

---

## Phase 3: Marketplace publish-side (condo)

**Goal:** A board member can take an existing `MaintenanceTicket` and publish it to the marketplace, choosing what's exposed.

- [ ] **Step 1: "Publish to marketplace" action** on the ticket detail page. Board-only. Opens a **three-step wizard modal** (Tartalom → Mit látnak → Megerősítés). Pre-fills `scrubbedTitle`/`scrubbedDescription` from the ticket and lets the publisher edit them.

  **Step 1 fields (Tartalom):** title, description, specialty (defaults from ticket category), urgency (Sürgős 48ó / Közepes 14n / Tervezett 60n), budget band (4 chips, optional), bid deadline (3 presets), expected start (3 presets), three privacy toggles (reveal address / reveal unit / reveal owner phone), board contact email + optional mobile.

  **Step 2 (Mit látnak / "what they see"):** split-pane modal — left is the editable form, right is a **live preview** that mirrors exactly what the contractor card looks like on `/contractor/marketplace`, plus a **scrubbed-fields diff table** ("Magánadatok · diff") listing every private field with a strike-through value and a ✗ icon, and every exposed field with the public value and a ✓ icon. The preview has an Asztali / Mobil / E-mail toggle.

  **Step 3 (Megerősítés):** legal attestation checkbox ("Megerősítem, hogy a felhívás jogos és a közös képviselő nevében járok el · P2B 2019/1150 · GDPR · DPA v3.1") and a primary "Publikálás a piactéren →" button. Footer also exposes "Vázlat mentése" and "← Vissza".

- [ ] **Step 2: Server action** `publishTicketToMarketplace(ticketId, formData)`. Creates a `MarketplacePublication` row with the scrubbed values + the three privacy-toggle flags. Returns the publication id.

- [ ] **Step 3: Listing service** `src/lib/marketplace/publishing.ts`. Provides `getOpenPublications(filters)` — the ONLY way the contractor-side reads ticket data. Never joins back to `MaintenanceTicket` until award.

- [ ] **Step 4: Live-preview component**. Reuses the `LeadCard` from Phase 4 so the preview is bit-identical to what the contractor will see — single source of truth, no drift.

- [ ] **Step 5: Status surfaced on the ticket** — the ticket page shows "Published to marketplace · 0 bids", "5 bids · pick one", "Awarded to X". A board member can `closeWithoutAward` if they change their mind.

---

## Phase 4: Browse + bid-side (contractor)

**Goal:** A contractor finds relevant leads on the marketplace board and submits a bid; the board reviews bids and awards one.

- [ ] **Step 1: `/contractor/marketplace` board**. Lists OPEN publications filtered by the contractor org's specialties + regions. Filters: specialty, urgency, city, posted-in-last-X-days. Cards show: scrubbed title, category icon, urgency pill, city/zip, budget band, posted-at, bid count.

- [ ] **Step 2: Publication detail** at `/contractor/marketplace/[id]`. Renders the scrubbed publication + the contractor's own bid (if any) + a bid-submission form.

- [ ] **Step 3: Bid submission** — POST `/api/contractor/bids`. Validates: contractor is ACTIVE; the org's specialties intersect the publication's; the publication is still OPEN; the contractor hasn't already bid (else this is an edit). Enforces the plan throughput quota: FREE = ≤3 bids in the trailing 7 days; PRO/PREMIUM = unlimited (see Phase 6). A "Historical median for this specialty + city" widget appears next to the bid form, computed from past `AWARDED`+`CLOSED` publications matching specialty + city (≥10 sample threshold; nothing shown otherwise — never derived from in-flight bids).

- [ ] **Step 4: Bid notification** — when a new bid lands, `notify()` pings the publishing board member with type `MARKETPLACE_NEW_BID`. The notification routes through the existing email pipeline (re-uses `notificationEmail` template).

- [ ] **Step 5: Bid review page** at `/maintenance/tickets/[id]/bids` — condo-side, board-only. Each bid card shows: rank badge + contractor logo + display name + distance, trust signals row (rating ★/5, lezárt munka count, átl. válaszidő, NAV-igazolva, felelősségbiztosítás), bid notes (quoted), tag pills (e.g. "Hétvégén is", "Saját pára-elszívó"), amount + delta-vs-median, ETA breakdown ("kezdés + kivitelezés / nap, befejezés: …"). Three actions per bid: **Elnyerés odaítélése** (primary), **Elutasítás (indoklással)**, **Üzenet · névtelen** (opens Phase 5 messaging thread).

  Default sort: best-fit (Phase 5, rule-based). Other sorts: legolcsóbb / leggyorsabb / legjobb értékelés / legrégebbi. Comparison checkbox per card adds it to an "Összehasonlítás" tray.

  Header shows publication summary card ("Hirdetés megtekintése", "Üzenet az összes pályázónak", "Hirdetés lezárása") + bid-count meta.

- [ ] **Step 6: Award flow**. Awarding flips publication to `AWARDED`, the winning bid to `WON`, all other bids to `REJECTED` (with auto-reason "Másik ajánlat lett kiválasztva"), and writes `awardedContractorId` onto the underlying ticket. Sends the winner an email with the full address + board contact **within 5 minutes**. Sends each loser the rejection email (P2B Art. 4: written reason). All `MarketplaceMessage` threads on losing bids are soft-purged 30 days after rejection per GDPR retention rules.

- [ ] **Step 7: Awarded ticket slots into the existing flow**. The ticket now follows the standard board → contractor lifecycle. The contractor sees the ticket on `/contractor/projects`.

---

## Phase 5: Trust, best-fit ranking, messaging, safety

**Goal:** Surface enough signal that condos pick contractors with confidence; let board + contractor negotiate without leaving the platform or breaching anonymity; keep platform-side moderation in the loop.

- [ ] **Step 1: Rating workflow at job completion**. When a board marks a ticket `COMPLETED`, they're prompted to rate the contractor (1–5 + free-text). Re-uses existing `ContractorRating` shape; the marketplace surfaces aggregated stats: average, count, "rated in last 12 months".

- [ ] **Step 2: Response-time tracking**. Record `firstBidAt` on a publication when the first bid arrives. Track per-contractor: median time-to-bid on publications matching their specialty. Surface "Általában 8 órán belül válaszol" on bid cards. Surface the all-time fastest responder badge.

- [ ] **Step 3: Trust badges**. NAV-confirmed; >5 lezárt munka; consistent 4+ rating; insurance current; "Helyszínhez közeli" (<5 km from publication ZIP); "Kerületi szakértő" (≥3 awarded jobs in the same city district).

- [ ] **Step 4: Best-fit ranker** (`src/lib/marketplace/fit-scoring.ts`). **Deterministic rule-based scoring — no LLM tokens, no external ML service**. The user-facing copy may say "Közös AI · best-fit" for marketing reasons, but the engineering is a documented weighted-sum on first-party data. Same inputs → same score, always.

  Composite 0–100 score per bid, computed on the bid-review page render (then cached as `MarketplaceFitScore`). Factor weights are documented + version-tagged so the scoring is **transparent per P2B Reg Art. 5**:
  - 25 pts — Price position vs band median (closer to median = higher; lowest-price doesn't auto-win, since "too cheap" is a quality signal)
  - 20 pts — Past rating average
  - 15 pts — Lezárt munka count (log-scaled, saturates at ~50)
  - 15 pts — Median response time
  - 10 pts — District/city specificity (count of past jobs in the same kerület)
  - 10 pts — ETA vs publication urgency
  - 5 pts — Insurance + NAV verification freshness

  **Rationale text is templated, not generated**: the ranker emits a short Hungarian sentence by picking the top-3 contributing factors and slotting them into fixed phrases (e.g. "Ár a sáv közepén" / "ETA átlag alatt" / "Kerületi szakértelem"). A `phraseBank.ts` file maps each (factor, bin) pair to a phrase fragment; copy edits happen there, not in product code.

  The bid review page defaults to best-fit sort but offers an explicit "Klasszikus" toggle. **Advisory only** — the board always picks manually. The weights version (e.g. `v1.0.0`) + the snapshotted factor values are logged with each award decision so the rationale is reproducible months later, even after weights are re-tuned.

- [ ] **Step 5: Anonymous messaging** (`MarketplaceMessage`). Plain-text threads scoped to one (publication, bidder) pair. Pre-award the contractor sees the condo side as "Közös képviselő" (no name). Post-award the names + contacts unmask for the winning thread only. Losing threads are read-only after rejection and soft-purged after 30 days. Re-uses the existing notification pipeline (new event types: `MARKETPLACE_MESSAGE_BOARD`, `MARKETPLACE_MESSAGE_CONTRACTOR`).

- [ ] **Step 6: Dispute flow**. Either side can flag a bid, award, or message thread. Disputes land in a moderation queue for the platform operator. Soft enforcement only — no automated suspension.

---

## Phase 6: Pricing tiers + Stripe (contractor-side billing)

**Goal:** Free-tier throughput + specialty/region caps maintain conversion pressure; paid tiers unlock leads, integrations, and (Premium) account management. Win-or-refund guarantee differentiates against thumbtack-style competitors.

See the `Pricing tiers` table earlier in this document for the full tier definitions.

- [ ] **Step 1: Plan model**. `ContractorPlan` enum already in the schema. Quota helpers in `src/lib/marketplace/pricing.ts` enforce **three** axes:
  1. Bid throughput per rolling 7 days (Free = 3, paid = ∞)
  2. Specialty count (Free = 1, Pro = 5, Premium = ∞)
  3. Region count (Free = 1, Pro = 5, Premium = ∞)

- [ ] **Step 2: Stripe products + prices**. Mirror the existing condo-side billing structure. Use the same webhook entry point with a discriminator (`metadata.product === "contractor"`) to route into the contractor plan-update path. **Trial: 14 days of Pro on signup, no card required.**

- [ ] **Step 3: Checkout flow** at `/contractor/settings/billing`. Trial: 30 days of Pro on signup.

- [ ] **Step 4: Quota enforcement** at the bid-submission endpoint. 429 + "Upgrade your plan" inline UI when the cap is hit.

- [ ] **Step 5: Featured ranking** on the marketplace board for Premium tier.

---

## Phase 7: Compliance, notifications, marketing surface

**Goal:** Ship-ready. DSA/P2B/GDPR boxes checked, both sides have notification coverage, public-facing pricing/landing pages exist.

- [ ] **Step 1: Notification matrix additions**. Add `marketplace` row to the user-facing prefs matrix (board side) and to the contractor `ContractorUser.notificationPreferences`. Events:
  - Board: `MARKETPLACE_NEW_BID`, `MARKETPLACE_NO_BIDS_AFTER_72H`, `MARKETPLACE_MESSAGE_CONTRACTOR`
  - Contractor: `MARKETPLACE_LEAD_MATCH`, `MARKETPLACE_BID_WON`, `MARKETPLACE_BID_REJECTED`, `MARKETPLACE_MESSAGE_BOARD`, `MARKETPLACE_DOC_EXPIRY` (insurance / license docs nearing `validUntil`)
  - SMS channel (Premium tier only): same events as push, gated by `ContractorOrg.plan === "PREMIUM"`.

- [ ] **Step 2: Marketing landing page** at `/contractor` (public, anonymous-accessible). Pricing table, value prop, sample lead-card screenshot, signup CTA.

- [ ] **Step 3: DSA terms of service**. Statement of reasons template on rejected bids; notice-and-action contact email; transparent ranking criteria document.

- [ ] **Step 4: P2B compliance**. 30-day-notice mechanism for terms changes (banner + email to all active orgs). Written reason on every bid rejection (already required by the flow).

- [ ] **Step 5: GDPR DPA addendum** as part of the onboarding accept step. Stores `dpaSignedAt` on `ContractorOrg`.

- [ ] **Step 6: Contractor data export** (GDPR Art. 15) on `/contractor/settings`. Mirrors the existing condo-side personal-data export flow.

---

## Out of scope (tracked for follow-up)

- Native mobile app for contractors.
- Platform-held escrow.
- Insurance brokering — we surface uploaded docs, we don't sell policies.
- Automated dispatch (auto-award lowest bid) — the AI ranker (Phase 5) is advisory only.
- Multi-country — HU only at launch.
- Contractor-to-contractor subcontracting flows.
- Rich-text / attachment messaging — Phase 5 messages are plain-text only.
- Real-time presence indicators in the messaging panel.
- Bid revisions visible to the board ("v1: 380K, v2: 360K") — Phase 5 stores only the latest snapshot.

---

## Acceptance criteria

This plan is complete when:

1. A new contractor can sign up at `/contractor/signup`, complete KYC with NAV-validated tax ID, upload documents, and reach `ACTIVE` status within 15 minutes without human intervention.
2. A board member completing the three-step publish wizard can preview the contractor-side card live before publishing, and the public listing does NOT reveal the building name, full address, owner identity, or unit number until the bid is awarded. The Mit látnak step shows a complete scrubbed-fields diff.
3. Two contractors bidding on the same publication never see each other's bids — neither prices, ETAs, identities, nor message threads.
4. A contractor on the FREE plan is blocked from submitting a 4th bid in any rolling 7-day window with a clear "Upgrade to Pro" prompt; specialty/region pickers show "Free: 1 / 1" caps.
5. When the board awards a bid, the winning contractor receives an email within **5 minutes** containing the full address + board contact, and all losing bidders receive a rejection email with the reason text (P2B Art. 4).
6. The contractor sees average rating, completed-job count, NAV-confirmed badge, insurance badge, median response time, and (in Premium-featured listings) the best-fit score visibly on their public profile and on every bid card.
7. The marketplace board paginates and filters cleanly with 1,000+ open publications across all condos.
8. Stripe webhooks correctly route condo-side and contractor-side payment events without crosstalk.
9. A GDPR Art. 15 export from `/contractor/settings` returns the contractor's complete data set, including all bids ever submitted and all message threads (including soft-purged ones within their retention window).
10. The system suspends a contractor after a manual moderator action, blocks new bids from that org, and notifies all open publications they bid on.
11. The best-fit ranker (Phase 5) computes scores from versioned, documented weights with no LLM/ML model dependency; the same input set produces byte-identical output every time; the decision audit trail captures the weights version + snapshotted factor values used at award time.
12. Anonymous messaging (Phase 5) hides the board user's name pre-award; on award the names unmask on the winning thread; losing threads become read-only and soft-purge after 30 days.
13. The 8-month win-or-refund guarantee fires automatically when an eligible org reaches that threshold without a single won bid — no support ticket required.

When all thirteen hold, the marketplace is launch-ready.

---

## Open questions for product

1. **Single board contact vs. broadcast** — when the bid is awarded, do we expose only one board contact, or the whole board's emails? Recommend single-contact for accountability.
2. **Anonymous browsing** — can a contractor browse the board before signing up (logged-out)? Recommend NO — friction for signup is also a quality filter.
3. **Reverse direction** — can a board *invite* specific contractors to bid (private invite list), bypassing the open marketplace? Possible Phase 8.
4. **Cross-condo contractor preference** — should a condo board be able to mark a contractor as "preferred" and have their bids surface first on future publications? Strong stickiness mechanic, defer to Phase 8.
5. **Rating gameability** — should ratings be ticket-locked (one rating per ticket) and require completion? Yes — Phase 5 already wires this.
6. **Contractor verification flow when NAV API is down** — manual operator approval path needed, even at launch.
