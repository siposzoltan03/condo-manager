# Roles Legal-Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the role and permission model so it matches what Hungarian condo law (2003. évi CXXXIII. tv. — "Tht.") actually requires, recognizes, or rejects. Resolve gaps surfaced by the design vs. implementation analysis (2026-04-27): no FB/auditor role, no chair distinction, no professional-manager flag, no officer-registry deadline tracking, RESIDENT semantics conflate ownership with login privilege, and several GDPR/communication duties are unmodeled.

**Architecture:** Five sequential phases, each a separate commit, each leaves the app functional. Phase 1 introduces the chair + professional flags on existing UserBuilding. Phase 2 adds the audit committee and external auditor as first-class entities. Phase 3 renames RESIDENT to OWNER and adds an explicit `livesAtUnit` flag (decoupling residency from privilege). Phase 4 denormalizes the four legal thresholds (>6, >7, >25, >50/>20M HUF) and the 2026-10-31 officer-registry deadline onto Building. Phase 5 closes statutory communication and GDPR gaps (delivery proof, vendor anonymization layer, camera retention, arrears disclosure mode).

**Tech Stack:** Prisma, PostgreSQL, Next.js 15, NextAuth v5, next-intl

**Spec source:** `docs/plans/2026-04-27-roles-design-vs-implementation-analysis.md` (gap report) and Hungarian condo law research dated 2026-04-27 — see § citations inline below.

**Non-goals:**
- Building a vendor portal. The law does not require contractors to log in; modelling them as `Contractor` records with anonymized ticket views is enough and reduces GDPR surface area.
- Adding "rezidens" vs. "távoli tulajdonos" as a privilege-bearing role. Tht. § 16, § 38 do not distinguish them; this plan removes the conflation rather than entrenching it.
- Building an impersonation flow for SUPER_ADMIN. Out of scope until product policy on GDPR-grade audit logging is decided; tracked separately.

---

## File Structure — What Changes

```
prisma/
├── schema.prisma                                    # Phase 1–5 schema changes; see per-phase task
├── migrations/                                      # 5 new migrations, one per phase
└── seed.ts                                          # Backfill chair/professional/livesAt/threshold flags

src/
├── lib/
│   ├── rbac.ts                                      # MODIFY: replace flat hierarchy with capability map
│   ├── capabilities.ts                              # NEW: capability matrix keyed by BuildingRole + flags
│   ├── thresholds.ts                                # NEW: Building threshold derivation (>6/>7/>25/>50/>20M)
│   ├── officer-registry.ts                          # NEW: 2026-10-31 deadline status helpers
│   ├── announcement-delivery.ts                     # NEW: delivery proof recording for § 33/A compliance
│   ├── vendor-anonymizer.ts                         # NEW: ticket view sanitization for Contractor PII
│   └── camera-retention.ts                          # NEW: 15-day rolloff job
├── app/
│   ├── [locale]/
│   │   ├── settings/
│   │   │   └── building-officers/
│   │   │       └── page.tsx                         # NEW: chair, professional flag, registry status, FB members
│   │   └── admin/
│   │       └── officer-registry/
│   │           └── page.tsx                         # NEW: cross-building registry deadline tracker
│   └── api/
│       ├── buildings/[id]/registry/route.ts         # NEW: PATCH registry status (képviselő or ADMIN)
│       ├── buildings/[id]/auditors/route.ts         # NEW: GET/POST auditor membership
│       └── buildings/[id]/cameras/route.ts          # NEW: camera CRUD with 15-day retention enforcement
├── components/
│   └── compliance/
│       ├── officer-registry-banner.tsx              # NEW: shown when deadline approaches
│       ├── audit-committee-required-banner.tsx      # NEW: shown when totalUnits crosses 25
│       └── arrears-disclosure-warning.tsx           # NEW: blocks public posting of arrears + names
├── i18n/
│   ├── en.json                                      # Add roles.*, compliance.*, registry.* keys
│   └── hu.json                                      # Same — Hungarian primary
└── types/
    └── next-auth.d.ts                               # Session adds isChair, isProfessional, isAuditor
```

---

## Legal Anchors

Each change in this plan must keep this anchor table accurate. Cite the § in the migration's git message.

| Concern | Statute / source | Notes |
|---|---|---|
| Single representative ↔ board with chair | Tht. § 27 (1)–(2); § 43 vests authority in közös képviselő OR intézőbizottság chair | Chair has same legal authority as a single rep |
| Audit committee mandatory threshold | Tht. § 27 (3) — committee mandatory **above 25 lakás** | Members must be tulajdonostársak; outsiders may not serve |
| External auditor mandatory threshold | Tht. § 51/A — **above 20M HUF annual cashflow OR above 50 units** | Exception if képviselő/FB member is CPA |
| Professional manager certification | Tht. § 52, § 54 | Akkreditált szakképesítés post-OKJ; assembly may compel above 6 units (§ 55) |
| Officer registry | Tht. § 55/A–D — földhivatal registry; deadline **2026-10-31** | Extended by 2025. évi LXXXVIII. tv.; unregistered = invalid representation against third parties |
| No legal distinction rezidens/távoli | Tht. § 16, § 38 — only "tulajdonostárs" exists | Use `livesAtUnit` for UX hint, never for privilege |
| Bérlő scope | Tht. § 22 (2), § 26 (3) | Házirend addressee; no vote, no közgyűlés right; lakástörvény (1993. évi LXXVIII.) governs the rest |
| Notice board still mandatory | Tht. § 43 (1)–(2), § 43/A | Email is additional channel under § 33/A, not a replacement |
| Email delivery equivalence | Tht. § 33/A (in force 2025-01-01) | Requires verified addresses on file under § 22 + fallback |
| Arrears with names — public posting | NAIH guidance | Not allowed publicly; allowed at közgyűlés or in closed delivery |
| Vendor PII minimization | GDPR Art. 5(1)(c), Art. 28 | Vendor is adatfeldolgozó; needs DPA |
| Camera install threshold | Tht. § 25 — **2/3 of all ownership shares** | Cannot face apartment doors / sanitary spaces |
| Camera retention | Infotv. + NAIH guidance — **max 15 days** | Every access must be logged with reviewer + purpose |
| Retention generally | Számviteli tv. § 169 — accounting records 8 years | Resolution Book (Tht. § 44) for life of the condominium |

---

## Phase 1: Officer model refinement (chair + professional manager)

**Goal:** Encode the legal distinction between (a) a single közös képviselő and (b) the chair (elnök) of an intézőbizottság — the law treats their authority identically (§ 43) but the flat `BOARD_MEMBER` enum cannot represent at-most-one-chair. Also introduce the professional-manager flag.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration
- Modify: `prisma/seed.ts`
- Modify: `src/lib/rbac.ts`
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth-options.ts`

- [ ] **Step 1: Add fields to `UserBuilding`**

```prisma
model UserBuilding {
  // ...existing fields...
  isChair                     Boolean   @default(false)        // Tht. § 27(2)–(3); intézőbizottság elnök OR sole közös képviselő
  isProfessional              Boolean   @default(false)        // Tht. § 52, § 54 — üzletszerű kezelő
  accreditationDocumentId     String?                          // pointer to Document holding szakképesítés evidence
  accreditationVerifiedAt     DateTime?                        // set by ADMIN when reviewed
  accreditationVerifiedById   String?
  accreditationVerifiedBy     User?     @relation("AccreditationVerifier", fields: [accreditationVerifiedById], references: [id])
}
```

- [ ] **Step 2: Add a partial unique index for one chair per building**

The Prisma schema can declare it; Postgres applies it as a partial unique index. If Prisma DSL doesn't support partial indexes natively, write the SQL in the migration's `migration.sql` after `prisma migrate dev --create-only`:

```sql
CREATE UNIQUE INDEX "UserBuilding_buildingId_chair_unique"
  ON "UserBuilding" ("buildingId")
  WHERE "isChair" = true;
```

- [ ] **Step 3: Update RBAC**

Replace the flat hierarchy with a capability map. The capability map is the authoritative answer to "what can this user do?" — the hierarchy is kept only for legacy `hasMinimumRole` calls during the migration.

Create `src/lib/capabilities.ts`:

```ts
import type { BuildingRole } from "@prisma/client";

export type Capability =
  | "manage.budget"
  | "approve.invoice"
  | "view.building.finance"
  | "view.own.unit.finance"
  | "vote.cast"
  | "vote.start"
  | "vote.editMinutes"
  | "ticket.report"
  | "ticket.assign"
  | "announcement.publish"
  | "announcement.boardChannel"
  | "document.publish.public"
  | "document.publish.boardOnly"
  | "residents.viewAll"
  | "residents.viewSameStaircase"
  | "platform.impersonate"
  | "platform.featureFlags"
  | "auditor.readAll";

export interface ActorContext {
  role: BuildingRole;
  isChair?: boolean;
  isProfessional?: boolean;
  isAuditor?: boolean;          // populated in Phase 2
  ownsAnyUnit?: boolean;        // populated in Phase 3 from UnitUser
  livesAtUnit?: boolean;        // UX hint only — never gate privilege on this
}

export function can(actor: ActorContext, cap: Capability): boolean {
  // SUPER_ADMIN gets platform caps but NOT building-level caps without impersonation
  if (actor.role === "SUPER_ADMIN") {
    return cap === "platform.impersonate" || cap === "platform.featureFlags";
  }
  // Chair / sole representative authority — Tht. § 43
  const hasRepresentativeAuthority =
    actor.role === "BOARD_MEMBER" && actor.isChair === true;

  switch (cap) {
    case "manage.budget":
    case "approve.invoice":
    case "vote.start":
    case "vote.editMinutes":
    case "ticket.assign":
    case "announcement.publish":
    case "announcement.boardChannel":
    case "document.publish.public":
    case "document.publish.boardOnly":
      return hasRepresentativeAuthority || actor.role === "ADMIN";
    case "view.building.finance":
      return actor.role === "BOARD_MEMBER" || actor.role === "ADMIN" || actor.isAuditor === true;
    case "view.own.unit.finance":
      return actor.ownsAnyUnit === true;
    case "vote.cast":
      return actor.ownsAnyUnit === true;        // tenants do not vote — Tht. § 38
    case "ticket.report":
      return actor.role !== "SUPER_ADMIN";
    case "residents.viewAll":
      return actor.role === "BOARD_MEMBER" || actor.role === "ADMIN";
    case "residents.viewSameStaircase":
      return actor.role === "OWNER" || actor.role === "TENANT";  // OWNER added in Phase 3
    case "auditor.readAll":
      return actor.isAuditor === true;
    default:
      return false;
  }
}
```

Modify `src/lib/rbac.ts`:

- Keep `ROLE_HIERARCHY` and `hasMinimumRole` for legacy callers but mark them deprecated in JSDoc.
- Re-export `can()` from `capabilities.ts`.
- Replace `canManageFinances`, `canManageAnnouncements`, `canManageDocuments` with thin wrappers around `can()` so existing imports continue to compile.

- [ ] **Step 4: Session and auth changes**

`src/types/next-auth.d.ts`:
```ts
declare module "next-auth" {
  interface Session {
    user: {
      // ...existing...
      activeBuildingId: string;
      activeRole: BuildingRole;
      isChair: boolean;
      isProfessional: boolean;
      // isAuditor added in Phase 2
    };
  }
}
```

`src/lib/auth-options.ts`: when populating the session for the active building, read `isChair` and `isProfessional` from the matching `UserBuilding` row.

- [ ] **Step 5: Run migration and seed**

```bash
npx prisma migrate dev --name phase1-chair-and-professional-flags
```

In `prisma/seed.ts`, mark exactly one BOARD_MEMBER per building as `isChair = true` (the existing test-account elnök). Set `isProfessional = false` everywhere except a deliberate one for testing.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(roles): phase 1 — add chair and professional flags (Tht. § 27, § 43, § 52)"
```

---

## Phase 2: Audit committee and external auditor

**Goal:** Model the **számvizsgáló bizottság** (audit committee) as a first-class concept with statutory thresholds. Tht. § 27 (3) makes it mandatory above 25 lakás; Tht. § 51/A makes a registered külső könyvvizsgáló mandatory above 20M HUF cashflow OR above 50 units. Members of the FB must be tulajdonostársak.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration
- Modify: `src/lib/capabilities.ts` — set `isAuditor` capability paths
- Modify: `prisma/seed.ts`
- Create: `src/app/api/buildings/[id]/auditors/route.ts`
- Create: `src/app/[locale]/settings/building-officers/auditor-list.tsx` (component)

- [ ] **Step 1: Add `BuildingRole.AUDITOR`**

```prisma
enum BuildingRole {
  SUPER_ADMIN
  ADMIN
  BOARD_MEMBER
  AUDITOR              // NEW — Tht. § 27(3) számvizsgáló bizottság tag
  RESIDENT             // (renamed to OWNER in Phase 3)
  TENANT
}
```

The migration is non-destructive; existing rows are unaffected. AUDITOR is a peer of BOARD_MEMBER — it is **not** in the linear hierarchy. The `can()` map handles this correctly already because it switches on `role === "AUDITOR"` and on `actor.isAuditor` independently.

- [ ] **Step 2: Add `AuditorMembership` model**

A separate model (rather than a flag on UserBuilding) lets one building keep a history of past auditors and lets one user serve in different capacities across buildings. Members must be tulajdonostársak — enforced at the application layer with a check that the user has at least one `UnitUser` row with `relationship = OWNER` for this building.

```prisma
enum AuditorKind {
  COMMITTEE_MEMBER       // Tht. § 27(3); must be tulajdonostárs
  COMMITTEE_CHAIR        // chair of the FB
  REGISTERED_AUDITOR     // Tht. § 51/A bejegyzett könyvvizsgáló — need not be tulajdonostárs
}

model AuditorMembership {
  id          String      @id @default(cuid())
  user        User        @relation("AuditorMember", fields: [userId], references: [id])
  userId      String
  building    Building    @relation(fields: [buildingId], references: [id])
  buildingId  String
  kind        AuditorKind
  startedAt   DateTime    @default(now())
  endedAt     DateTime?
  createdAt   DateTime    @default(now())

  @@index([buildingId, kind])
  @@index([userId])
}
```

Add reverse relations:
```prisma
// Building
auditorMemberships AuditorMembership[]
// User
auditorMemberships AuditorMembership[] @relation("AuditorMember")
```

- [ ] **Step 3: Add a partial unique index for at-most-one committee chair per building**

```sql
CREATE UNIQUE INDEX "AuditorMembership_buildingId_committeeChair_unique"
  ON "AuditorMembership" ("buildingId")
  WHERE "kind" = 'COMMITTEE_CHAIR' AND "endedAt" IS NULL;
```

- [ ] **Step 4: Session reflects auditor status**

In `auth-options.ts`, when loading the active building, also query `AuditorMembership` for the user and set `session.user.isAuditor = true` if any active row exists. Add `isAuditor` to `next-auth.d.ts`.

- [ ] **Step 5: API + UI to manage auditors**

`/api/buildings/[id]/auditors`:
- `GET` — return current and historical auditors. Allowed: BOARD_MEMBER, AUDITOR, ADMIN.
- `POST` — add an auditor. Allowed: chair (BOARD_MEMBER + isChair) or ADMIN. Must validate that for COMMITTEE_MEMBER/CHAIR the user has at least one `UnitUser{ relationship: OWNER }` for this building (Tht. § 27 (3)).
- `PATCH /:id` — set `endedAt` (recall). Allowed: chair, ADMIN, or the auditor themselves resigning.

UI page `/settings/building-officers` lists the chair, professional flag status, and the FB members + external auditor (if assigned). Surface a banner when the building's `requiresAuditCommittee` (added Phase 4) is true and no committee exists.

- [ ] **Step 6: Run migration + seed**

```bash
npx prisma migrate dev --name phase2-auditor-membership
```

Seed: in the test building with >25 simulated units, attach 3 owners as COMMITTEE_MEMBER and one as COMMITTEE_CHAIR.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(roles): phase 2 — audit committee and registered auditor (Tht. § 27(3), § 51/A)"
```

---

## Phase 3: Drop RESIDENT semantics; introduce `livesAtUnit`

**Goal:** RESIDENT currently conflates two unrelated things — "owns at least one unit" and "logs in at all". Tht. has only `tulajdonostárs` and `bérlő`. Privilege follows ownership (UnitUser.relationship = OWNER) and tenancy (= TENANT). "Lives here" is a UX hint, not a privilege gate.

**Strategy:** Two-step rename to keep the app functional throughout.
1. Add `OWNER` enum value and migrate every UserBuilding row from RESIDENT to OWNER.
2. Add `UnitUser.livesAtUnit Boolean @default(false)`.
3. Drop RESIDENT after all code reads OWNER.

**Files:**
- Modify: `prisma/schema.prisma`
- Two migrations: `phase3a-add-owner-role` and `phase3b-drop-resident`
- Migrate code paths reading `RESIDENT` → `OWNER`
- Modify: `src/lib/capabilities.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Phase 3a schema**

```prisma
enum BuildingRole {
  SUPER_ADMIN
  ADMIN
  BOARD_MEMBER
  AUDITOR
  OWNER                  // NEW — Tht. § 16 tulajdonostárs login
  RESIDENT               // KEPT — to be removed in 3b
  TENANT
}

model UnitUser {
  // ...existing...
  livesAtUnit  Boolean  @default(false)   // UX hint only — Tht. has no rezidens/távoli legal distinction
}
```

- [ ] **Step 2: Data migration script**

Create `prisma/migrate-resident-to-owner.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Move every RESIDENT membership to OWNER
  const updated = await prisma.userBuilding.updateMany({
    where: { role: "RESIDENT" },
    data: { role: "OWNER" },
  });
  console.log(`Migrated ${updated.count} UserBuilding rows from RESIDENT to OWNER.`);

  // Default livesAtUnit = true for every UnitUser whose relationship is OWNER and who has
  // no other unit; this is a heuristic, can be corrected per-user later.
  const unitUsers = await prisma.unitUser.findMany({
    where: { relationship: "OWNER" },
    include: { user: { include: { unitUsers: true } } },
  });
  for (const uu of unitUsers) {
    if (uu.user.unitUsers.length === 1) {
      await prisma.unitUser.update({
        where: { id: uu.id },
        data: { livesAtUnit: true },
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
```

Run after the schema migration:
```bash
npx prisma migrate dev --name phase3a-add-owner-role
npx tsx prisma/migrate-resident-to-owner.ts
```

- [ ] **Step 3: Code migration**

Search the codebase for `"RESIDENT"` and `BuildingRole.RESIDENT` (likely in `rbac.ts`, `sidebar.tsx`, several actions, several API routes, the i18n message keys, the seed). Replace each with `"OWNER"`.

Special attention to:
- `src/components/layout/sidebar.tsx` — Finance and Voting items currently mount at `TENANT`. Change to `OWNER` (board chair + admin keep their full access via `can("view.building.finance")` and `can("vote.start")`). Tenants stop seeing Finance and Voting in the sidebar — Tht. § 38 says tenants do not vote, and finance is not their concern.
- `prisma/seed.ts` — switch test users.
- Any `findMany` filtering on `role: "RESIDENT"`.

- [ ] **Step 4: Update capability map**

In `capabilities.ts`:
- `vote.cast` already keys off `actor.ownsAnyUnit` — no change needed.
- `view.own.unit.finance` already keys off `actor.ownsAnyUnit` — no change needed.
- Replace any literal `"RESIDENT"` cases with `"OWNER"`.

Add the `ownsAnyUnit` derivation in `auth-options.ts`: count UnitUser rows for the active building where relationship = OWNER. Set on session.

- [ ] **Step 5: Phase 3b — drop RESIDENT**

Once the code is fully migrated and CI green:

```prisma
enum BuildingRole {
  SUPER_ADMIN
  ADMIN
  BOARD_MEMBER
  AUDITOR
  OWNER
  TENANT
  // RESIDENT removed
}
```

```bash
npx prisma migrate dev --name phase3b-drop-resident
```

- [ ] **Step 6: Sidebar truth table**

Verify in `sidebar.tsx` that the visible items per role match:

| Item | OWNER | TENANT | BOARD_MEMBER + isChair | AUDITOR |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Announcements | ✓ | ✓ | ✓ (compose) | ✓ |
| Forum | ✓ | ✓ | ✓ | ✓ |
| Messages | ✓ | ✓ | ✓ | ✓ |
| Finance | ✓ (own units) | ✗ | ✓ (full) | ✓ (read-only) |
| Maintenance | ✓ (report) | ✓ (report own) | ✓ (assign) | read-only |
| Complaints | ✓ | ✓ | ✓ | read-only |
| Voting | ✓ (cast) | ✗ | ✓ (start) | read-only |
| Documents | ✓ | ✓ (public only) | ✓ (publish) | read-only |
| Users (lakók) | restricted | own staircase | full | read-only |
| Units (lakások) | ✗ | ✗ | ✓ | read-only |
| Buildings (admin) | ✗ | ✗ | ✗ | ✗ |
| Settings (profile) | ✓ | ✓ | ✓ | ✓ |

This table is the contract for end-to-end tests.

- [ ] **Step 7: Commit (twice — one per sub-phase)**

```bash
git commit -m "feat(roles): phase 3a — introduce OWNER, livesAtUnit; backfill from RESIDENT (Tht. § 16, § 38)"
# code migration commits as needed
git commit -m "feat(roles): phase 3b — drop RESIDENT enum value"
```

---

## Phase 4: Building thresholds and officer-registry deadline

**Goal:** Encode the four legal thresholds and the 2026-10-31 registry deadline as denormalized columns on `Building`, with derivation helpers and banners.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration
- Create: `src/lib/thresholds.ts`
- Create: `src/lib/officer-registry.ts`
- Create: banners under `src/components/compliance/`
- Modify: `src/components/layout/sidebar.tsx` (mount banners at the top)

- [ ] **Step 1: Add columns to `Building`**

```prisma
model Building {
  // ...existing...
  totalUnits                      Int       @default(0)        // denormalized count of Unit
  annualCashflowHUF               Int       @default(0)        // denormalized; refreshed by yearly job
  requiresAuditCommittee          Boolean   @default(false)    // computed: totalUnits > 25
  requiresExternalAuditor         Boolean   @default(false)    // computed: totalUnits > 50 OR annualCashflowHUF > 20_000_000
  requiresProfessionalManager     Boolean   @default(false)    // computed: totalUnits > 6 (assembly may compel; tracked, not enforced)
  szmszRequired                   Boolean   @default(false)    // computed: totalUnits >= 7
  representativeRegisteredAt      DateTime?                    // when the képviselő completed § 55/A registration
  representativeRegistryDeadline  DateTime  @default(dbgenerated("'2026-10-31 23:59:59+02'::timestamptz"))
}
```

- [ ] **Step 2: Threshold derivation helper**

Create `src/lib/thresholds.ts`:

```ts
import type { Building } from "@prisma/client";

const TWENTY_M = 20_000_000;
export function deriveThresholdFlags(b: Pick<Building, "totalUnits" | "annualCashflowHUF">) {
  return {
    requiresAuditCommittee:        b.totalUnits > 25,
    requiresExternalAuditor:       b.totalUnits > 50 || b.annualCashflowHUF > TWENTY_M,
    requiresProfessionalManager:   b.totalUnits > 6,
    szmszRequired:                 b.totalUnits >= 7,
  };
}

export async function refreshBuildingThresholds(prisma: PrismaClient, buildingId: string) {
  const building = await prisma.building.findUniqueOrThrow({
    where: { id: buildingId },
    select: { id: true, units: { select: { id: true } } },
  });
  const totalUnits = building.units.length;
  // annualCashflowHUF: sum of LedgerEntry amounts in the last 12 months
  // (left as TODO with a stub — wired up after Finance module verifies LedgerEntry shape)
  const annualCashflowHUF = 0;
  const flags = deriveThresholdFlags({ totalUnits, annualCashflowHUF });
  await prisma.building.update({
    where: { id: buildingId },
    data: { totalUnits, annualCashflowHUF, ...flags },
  });
}
```

Hook `refreshBuildingThresholds` from:
- Unit creation/deletion server actions.
- A nightly worker job (already exists under `worker/`) for cashflow refresh.

- [ ] **Step 3: Officer registry helpers**

`src/lib/officer-registry.ts`:

```ts
import type { Building } from "@prisma/client";

export type RegistryStatus =
  | { kind: "registered"; at: Date }
  | { kind: "due-soon"; daysLeft: number }
  | { kind: "overdue"; daysOverdue: number }
  | { kind: "ok" };

export function getRegistryStatus(
  b: Pick<Building, "representativeRegisteredAt" | "representativeRegistryDeadline">,
  now = new Date(),
): RegistryStatus {
  if (b.representativeRegisteredAt) return { kind: "registered", at: b.representativeRegisteredAt };
  const deadline = b.representativeRegistryDeadline;
  const diffDays = Math.floor((deadline.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return { kind: "overdue", daysOverdue: -diffDays };
  if (diffDays <= 60) return { kind: "due-soon", daysLeft: diffDays };
  return { kind: "ok" };
}
```

- [ ] **Step 4: Compliance banners**

`src/components/compliance/officer-registry-banner.tsx`: shown to BOARD_MEMBER + isChair and ADMIN when status is `due-soon` or `overdue`. Links to `/admin/officer-registry`.

`src/components/compliance/audit-committee-required-banner.tsx`: shown to chair and ADMIN when `requiresAuditCommittee && !hasActiveCommittee`. Links to `/settings/building-officers#fb`.

Both banners are dismissible per session but not permanently — they reappear on next login until the underlying state is fixed.

- [ ] **Step 5: Cross-building admin page (SUPER_ADMIN)**

`/admin/officer-registry`: lists every building's registry status, sorted by deadline. Useful for support staff to nudge customers before 2026-10-31.

- [ ] **Step 6: Migration + seed**

```bash
npx prisma migrate dev --name phase4-thresholds-and-registry
```

Seed: set `totalUnits` correctly for the two test buildings; mark one as `representativeRegisteredAt = today` (compliant) and the other as `null` (so the banner is visible during dev).

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(roles): phase 4 — building thresholds and officer-registry deadline (Tht. § 27(3), § 51/A, § 55/A–D)"
```

---

## Phase 5: Communication and GDPR compliance

**Goal:** Close the four hard legal traps the law imposes on a condo SaaS:
1. Notice-board equivalence on every announcement (Tht. § 33/A; § 43/A).
2. Vendor PII anonymization (GDPR Art. 5(1)(c), Art. 28).
3. Camera retention max 15 days with access log (NAIH; Tht. § 25).
4. Arrears name-disclosure mode (NAIH).

This phase is the largest. Split into 5 commits.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration
- Create: `src/lib/announcement-delivery.ts`
- Create: `src/lib/vendor-anonymizer.ts`
- Create: `src/lib/camera-retention.ts`
- Modify: relevant action files and the worker

- [ ] **Step 1: Announcement delivery proof**

```prisma
enum AnnouncementChannel {
  EMAIL
  PUSH
  PHYSICAL_BOARD          // signed/timestamped record that it was posted
  SMS
}

enum DeliveryStatus {
  QUEUED
  DELIVERED
  FAILED
  ACK_REQUIRED
}

model AnnouncementDelivery {
  id              String              @id @default(cuid())
  announcement    Announcement        @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  announcementId  String
  user            User?               @relation("AnnouncementRecipient", fields: [userId], references: [id])
  userId          String?
  channel         AnnouncementChannel
  externalId      String?             // email message-id, push receipt id
  status          DeliveryStatus      @default(QUEUED)
  deliveredAt     DateTime?
  errorMessage    String?
  createdAt       DateTime            @default(now())

  @@index([announcementId, status])
  @@index([userId])
}
```

Announcement action records one delivery row per `(recipient, channel)`. For PHYSICAL_BOARD, one row per announcement signed by the képviselő (no userId). The 8-day deadline of § 40 (3) is enforced by a worker that flags announcements with no DELIVERED rows within 8 days.

Email-equivalent delivery (§ 33/A) is satisfied when at least one DELIVERED EMAIL row exists for a recipient whose email is on file in `User`. Otherwise the SaaS must require PHYSICAL_BOARD or fall back to mail.

Commit: `feat(communication): phase 5a — announcement delivery proof (Tht. § 33/A, § 40(3), § 43/A)`

- [ ] **Step 2: Vendor anonymization layer**

No schema change. Create `src/lib/vendor-anonymizer.ts`:

```ts
import type { MaintenanceTicket, Unit, User, UnitUser } from "@prisma/client";

export interface AnonymizedTicketView {
  id: string;
  trackingNumber: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  unitLabel: string;            // e.g. "A-lépcső · 4. em · 3" — never the resident's name
  contactFirstName: string | null; // first name only, only if entry needed
  contactPhoneMasked: string | null; // last 4 digits; routed through platform
}

export function anonymizeTicketForVendor(args: {
  ticket: MaintenanceTicket;
  unit: Unit;
  primaryContact: (UnitUser & { user: Pick<User, "name"> }) | null;
  contactPhone: string | null;
  needsEntry: boolean;
}): AnonymizedTicketView {
  // ...build the unitLabel from staircase + floor + door, never name; mask phone unless needsEntry
}
```

The vendor-facing API endpoints (`/api/vendor/tickets/...`) — to be added in a separate vendor-portal plan — must use this function exclusively. For now, callers in the existing maintenance views can adopt it when rendering ticket cards seen by external users.

Add a stored `Contractor.dataProcessingAgreementDocumentId String?` link to a Document so we have proof of the DPA on file (GDPR Art. 28). Deny ticket assignment to a Contractor with no DPA document.

```prisma
model Contractor {
  // ...existing...
  dataProcessingAgreementDocumentId  String?
  dataProcessingAgreementDocument    Document?   @relation("ContractorDPA", fields: [dataProcessingAgreementDocumentId], references: [id])
}
```

Commit: `feat(privacy): phase 5b — vendor PII anonymizer + Contractor DPA (GDPR Art. 5(1)(c), Art. 28)`

- [ ] **Step 3: Camera install + retention**

```prisma
model BuildingCamera {
  id                 String     @id @default(cuid())
  building           Building   @relation(fields: [buildingId], references: [id])
  buildingId         String
  location           String     // human-readable; must not face apartment doors per Tht. § 25
  installedByVoteId  String?    // pointer to the Vote that authorised it (must be 2/3 of total shares)
  installedAt        DateTime   @default(now())
  retentionDays      Int        @default(15)   // NAIH: max 15 for ordinary buildings
  isActive           Boolean    @default(true)

  accessLogs         CameraAccessLog[]

  @@index([buildingId])
}

model CameraAccessLog {
  id          String          @id @default(cuid())
  camera      BuildingCamera  @relation(fields: [cameraId], references: [id])
  cameraId    String
  reviewer    User            @relation("CameraReviewer", fields: [reviewerId], references: [id])
  reviewerId  String
  reason      String          // Tht. § 25 — purpose mandatory
  reviewedAt  DateTime        @default(now())

  @@index([cameraId, reviewedAt])
  @@index([reviewerId])
}
```

Add a worker job that purges any `Footage` storage (out of scope here — likely S3 bucket lifecycle) older than `retentionDays` for each camera. Add `src/lib/camera-retention.ts` with the purge driver.

Camera install API requires:
- Reference to a passed Vote with `MajorityType.TWO_THIRDS` and `result.passed === true` against **total** shares — Tht. § 25.
- Privacy notice document on file (Document with category `privacy-notice`).

Commit: `feat(privacy): phase 5c — camera install vote and 15-day retention with access log (Tht. § 25, NAIH)`

- [ ] **Step 4: Arrears disclosure mode**

```prisma
enum ArrearsDisclosureMode {
  INTERNAL_ONLY            // default — visible only at közgyűlés or to the named owner
  CLOSED_DELIVERY          // sealed envelope to each owner, names allowed
  // No PUBLIC option exists — NAIH explicitly forbids posting names + amounts publicly
}

model Building {
  // ...existing...
  arrearsDisclosureMode    ArrearsDisclosureMode  @default(INTERNAL_ONLY)
}
```

Add `src/components/compliance/arrears-disclosure-warning.tsx` shown wherever a UI surface aggregates arrears with names. Block any export/print path that would render names + amounts in a publicly distributable format. The kifüggesztés-style poster generator (if/when built) must pull only anonymized aggregate data.

Commit: `feat(privacy): phase 5d — arrears disclosure mode with NAIH-compliant defaults`

- [ ] **Step 5: Bérlő consent capture for contact data**

```prisma
model UnitUser {
  // ...existing...
  contactConsentAt   DateTime?    // when bérlő consented to share phone/email beyond § 22(2) bare minimum
  contactConsentMode String?      // "explicit" | "legitimate-interest" — for audit trail
}
```

The tenant onboarding flow (when an owner adds a bérlő or when a bérlő accepts an invitation) must offer a clear consent step before the SaaS stores phone/email. Without consent, the system retains only name and presence — which is what § 22 (2) actually requires.

Commit: `feat(privacy): phase 5e — bérlő contact consent capture (GDPR Art. 6, Tht. § 22(2))`

---

## Cross-cutting work — i18n and tests

- [ ] **i18n keys** — every new UI string lands first in `i18n/hu.json` (primary), then `i18n/en.json`. Key prefixes: `roles.*`, `compliance.*`, `registry.*`, `auditor.*`, `cameras.*`, `consent.*`. Hungarian strings must use the precise legal terms (közös képviselő, intézőbizottság elnöke, számvizsgáló bizottság tagja, bejegyzett könyvvizsgáló, etc.) — not casual translations.

- [ ] **End-to-end tests** (Playwright):
  - One test per row of the sidebar truth table from Phase 3 Step 6.
  - One test verifying that a TENANT cannot navigate to `/finance` even by direct URL.
  - One test verifying the audit-committee banner appears when `totalUnits > 25 && !hasActiveCommittee`.
  - One test verifying the registry banner appears when `representativeRegisteredAt = null && deadline within 60 days`.
  - One test verifying that ticket assignment is blocked for a Contractor with no DPA document.
  - One test verifying that the announcement compose flow records at least one PHYSICAL_BOARD delivery row.

- [ ] **Unit tests** (Vitest):
  - `capabilities.test.ts` — cover the full `can()` matrix for every (BuildingRole × isChair × isProfessional × isAuditor × ownsAnyUnit) combination meaningful to the design.
  - `thresholds.test.ts` — boundary cases at 6, 7, 25, 50 units and at 19_999_999 / 20_000_000 / 20_000_001 HUF.
  - `officer-registry.test.ts` — edge cases at deadline ±1 day.
  - `vendor-anonymizer.test.ts` — verifies no resident name leaks across a property-based sweep of synthetic tickets.

---

## Out of scope (tracked for follow-up)

These items came up in the gap analysis but do not belong in this plan. File a separate issue for each before merging Phase 5.

- **Vendor portal (Külső partner login)** — model contractors as Users. Sizable; needs its own plan including a self-service onboarding flow, multi-building dashboard, and SLA tracking. Until then, contractors are notified via email only.
- **SUPER_ADMIN impersonation flow** — the design's szuperadmin POV claims a GDPR-logged impersonate. Needs product policy (which actions allowed, which always blocked) before schema work.
- **Push notifications and SMS as legal-equivalent channels** — Tht. § 33/A only blesses email. Push/SMS are supplementary today; legal-equivalence will require KAÜ-grade identification or a future legislative change.
- **Live `App - Roles.html` page** — render the design page itself once the model above is in place, with explicit "law-required" / "law-permits" / "product-only" badges. Original ask from 2026-04-27.
- **Alapító okirat / SZMSZ / Házirend documents as first-class entities** — currently ride in Documents with visibility flags. Promoting them to first-class would let the system enforce their amendment majorities (UNANIMOUS / TWO_THIRDS_OF_TOTAL / FOUR_FIFTHS_OF_TOTAL) directly. Worth a separate plan.
- **Vote tally on total vs. present shares** — verify that the existing vote-counting code anchors supermajorities on total shares (per Tht. § 38 + § 37 megismételt rule). Quick to verify, but if wrong it's a critical bug.

---

## Acceptance criteria

This plan is complete when:

1. `BuildingRole` enum is `{ SUPER_ADMIN, ADMIN, BOARD_MEMBER, AUDITOR, OWNER, TENANT }` — no RESIDENT.
2. Exactly one `UserBuilding` per building has `isChair = true` (or none, in transitional states).
3. `AuditorMembership` exists and its API + UI lifecycle works end-to-end.
4. `Building.totalUnits`, `requiresAuditCommittee`, `requiresExternalAuditor`, `requiresProfessionalManager`, `szmszRequired` are accurate after a unit insert/delete.
5. The sidebar truth table from Phase 3 Step 6 holds in Playwright.
6. An announcement creation produces at least one `AnnouncementDelivery` row per recipient and per channel chosen, including a PHYSICAL_BOARD row.
7. A Contractor with no `dataProcessingAgreementDocumentId` cannot be assigned a ticket.
8. Camera install requires a passed TWO_THIRDS vote AND a privacy-notice document; access logs every read.
9. The arrears warning component blocks export of named arrears in any UI marked public/board-distributable.
10. Bérlő contact data beyond name + presence is gated on `contactConsentAt`.

When all ten hold, the SaaS's role and permission model matches the legal floor of Hungarian condo law as of 2026-04-27.
