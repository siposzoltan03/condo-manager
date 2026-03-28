# Multi-Building Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from single-building to multi-building support — users can own multiple units across buildings, roles are per-building, building switcher in sidebar.

**Architecture:** 4-phase migration. Phase 1 adds new tables (non-breaking). Phase 2 migrates existing data. Phase 3 updates all application code (auth, APIs, UI). Phase 4 drops old columns. Each phase is a separate commit that keeps the app functional.

**Tech Stack:** Prisma, PostgreSQL, Next.js 15, NextAuth v5, next-intl

**Spec:** `docs/specs/2026-03-28-multi-building-migration.md`

---

## File Structure — What Changes

```
prisma/
├── schema.prisma                          # Add Building, UserBuilding, UnitUser; modify Unit, User
├── migrations/                            # New migration
└── seed.ts                                # Two buildings, multi-building seed data

src/
├── lib/
│   ├── auth-options.ts                    # Session reads from UserBuilding, stores activeBuildingId
│   ├── auth.ts                            # getCurrentUser returns activeBuildingId + activeRole
│   ├── rbac.ts                            # hasMinimumRole uses activeRole from session
│   └── building-context.ts                # NEW: helper to get/set active building from cookie
├── middleware.ts                           # Add activeBuildingId to session flow
├── hooks/
│   ├── use-auth.ts                        # Expose activeBuildingId, activeRole
│   └── use-building.ts                    # NEW: building switcher hook
├── components/
│   └── layout/
│       ├── sidebar.tsx                    # Building switcher dropdown at top
│       └── building-switcher.tsx          # NEW: dropdown component
├── app/
│   ├── api/
│   │   ├── buildings/
│   │   │   └── route.ts                   # NEW: GET list, POST create (SUPER_ADMIN)
│   │   ├── buildings/[id]/
│   │   │   └── route.ts                   # NEW: PATCH, DELETE
│   │   ├── buildings/switch/
│   │   │   └── route.ts                   # NEW: POST switch active building
│   │   ├── announcements/route.ts         # Add buildingId filter
│   │   ├── forum/categories/route.ts      # Add buildingId filter
│   │   ├── forum/topics/route.ts          # Add buildingId filter
│   │   ├── complaints/route.ts            # Add buildingId filter
│   │   ├── finance/charges/route.ts       # Filter via Unit.buildingId
│   │   ├── finance/summary/route.ts       # Filter via Account.buildingId
│   │   ├── finance/ledger/route.ts        # Filter via Account.buildingId
│   │   ├── finance/budget/route.ts        # Filter via Account.buildingId
│   │   ├── finance/accounts/route.ts      # Add buildingId filter
│   │   ├── maintenance/tickets/route.ts   # Add buildingId filter
│   │   ├── maintenance/scheduled/route.ts # Add buildingId filter
│   │   ├── voting/meetings/route.ts       # Add buildingId filter
│   │   ├── voting/votes/route.ts          # Add buildingId filter
│   │   ├── documents/route.ts             # Filter via category.buildingId
│   │   ├── documents/categories/route.ts  # Add buildingId filter
│   │   └── users/route.ts                 # Filter by UserBuilding for active building
│   └── [locale]/
│       └── admin/
│           └── buildings/
│               └── page.tsx               # NEW: building management page
├── components/
│   └── admin/
│       └── building-list.tsx              # NEW: building CRUD UI
├── i18n/
│   ├── en.json                            # Add building.* keys
│   └── hu.json                            # Add building.* keys
└── types/
    └── next-auth.d.ts                     # Add activeBuildingId, activeRole
```

---

## Task 1: Schema — Add New Tables (Phase 1, non-breaking)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums and models**

Add to schema.prisma (keep everything existing):

```prisma
enum BuildingRole {
  SUPER_ADMIN
  ADMIN
  BOARD_MEMBER
  RESIDENT
  TENANT
}

enum UnitRelationship {
  OWNER
  TENANT
}

model Building {
  id             String          @id @default(cuid())
  name           String
  address        String
  city           String
  zipCode        String
  units          Unit[]
  userBuildings  UserBuilding[]
  // Scoped entities:
  announcements       Announcement[]
  forumCategories     ForumCategory[]
  complaints          Complaint[]
  accounts            Account[]
  maintenanceTickets  MaintenanceTicket[]
  scheduledMaintenance ScheduledMaintenance[]
  meetings            Meeting[]
  documentCategories  DocumentCategory[]
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model UserBuilding {
  id         String       @id @default(cuid())
  user       User         @relation(fields: [userId], references: [id])
  userId     String
  building   Building     @relation(fields: [buildingId], references: [id])
  buildingId String
  role       BuildingRole @default(RESIDENT)
  isActive   Boolean      @default(true)
  createdAt  DateTime     @default(now())

  @@unique([userId, buildingId])
  @@index([buildingId])
  @@index([userId])
}

model UnitUser {
  id               String           @id @default(cuid())
  user             User             @relation(fields: [userId], references: [id])
  userId           String
  unit             Unit             @relation(fields: [unitId], references: [id])
  unitId           String
  relationship     UnitRelationship @default(OWNER)
  isPrimaryContact Boolean          @default(false)
  createdAt        DateTime         @default(now())

  @@unique([userId, unitId])
  @@index([unitId])
  @@index([userId])
}
```

- [ ] **Step 2: Add buildingId to Unit and all scoped root entities (nullable for now)**

Add to each model:
```prisma
// Unit
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])
unitUsers  UnitUser[]

// Announcement
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// ForumCategory
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// Complaint
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// Account
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// MaintenanceTicket
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// ScheduledMaintenance
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// Meeting
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])

// DocumentCategory
buildingId String?
building   Building? @relation(fields: [buildingId], references: [id])
```

- [ ] **Step 3: Add relations to User model**

```prisma
// Add to User:
userBuildings UserBuilding[]
unitUsers     UnitUser[]
```

Keep existing `role`, `unitId`, `isPrimaryContact` for now (Phase 4 removes them).

- [ ] **Step 4: Remove unique constraint on Unit.number**

Change `number String @unique` to `number String` — unit numbers are unique per building, not globally. Add a composite unique:
```prisma
@@unique([buildingId, number])
```

Similarly remove `@unique` from `ForumCategory.name` and add `@@unique([buildingId, name])`.

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add-multi-building-tables
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(multi-building): phase 1 — add Building, UserBuilding, UnitUser tables and buildingId columns"
```

---

## Task 2: Data Migration (Phase 2)

**Files:**
- Create: `prisma/migrations/manual-data-migration.ts`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Create data migration script**

Create `prisma/migrate-to-multi-building.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting multi-building data migration...");

  // 1. Create default building
  const building = await prisma.building.create({
    data: {
      name: "Default Building",
      address: "Please update",
      city: "Budapest",
      zipCode: "0000",
    },
  });
  console.log(`Created default building: ${building.id}`);

  // 2. Assign all units to default building
  const unitResult = await prisma.unit.updateMany({
    where: { buildingId: null },
    data: { buildingId: building.id },
  });
  console.log(`Assigned ${unitResult.count} units to default building`);

  // 3. Create UnitUser from existing User.unitId
  const users = await prisma.user.findMany({
    where: { unitId: { not: undefined } },
    select: { id: true, unitId: true, role: true, isPrimaryContact: true },
  });

  for (const user of users) {
    await prisma.unitUser.create({
      data: {
        userId: user.id,
        unitId: user.unitId,
        relationship: user.role === "TENANT" ? "TENANT" : "OWNER",
        isPrimaryContact: user.isPrimaryContact,
      },
    });
  }
  console.log(`Created ${users.length} UnitUser records`);

  // 4. Create UserBuilding from existing User.role
  for (const user of users) {
    await prisma.userBuilding.create({
      data: {
        userId: user.id,
        buildingId: building.id,
        role: user.role as any, // BuildingRole matches Role values
      },
    });
  }
  console.log(`Created ${users.length} UserBuilding records`);

  // 5. Set buildingId on all scoped entities
  const entities = [
    "announcement", "forumCategory", "complaint", "account",
    "maintenanceTicket", "scheduledMaintenance", "meeting", "documentCategory",
  ];
  for (const entity of entities) {
    const result = await (prisma as any)[entity].updateMany({
      where: { buildingId: null },
      data: { buildingId: building.id },
    });
    console.log(`Set buildingId on ${result.count} ${entity} records`);
  }

  console.log("Migration complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run data migration**

```bash
npx tsx prisma/migrate-to-multi-building.ts
```

- [ ] **Step 3: Update seed.ts for multi-building**

Rewrite seed to create two buildings with units and users in each:
- Building 1: "Duna Residence" — 5 units, original 8 users
- Building 2: "Margit Apartments" — 3 units, 4 users
- One user (the super admin) belongs to both buildings with different roles
- Create UserBuilding and UnitUser records instead of User.unitId/role
- Seed forum categories, accounts, contractors, document categories per building

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(multi-building): phase 2 — data migration script and multi-building seed"
```

---

## Task 3: Auth — Session with Building Context (Phase 3a)

**Files:**
- Modify: `src/lib/auth-options.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/rbac.ts`
- Create: `src/lib/building-context.ts`
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update NextAuth type declarations**

```typescript
// src/types/next-auth.d.ts
declare module "next-auth" {
  interface User {
    activeBuildingId: string;
    activeRole: string;
    buildings: { id: string; name: string; role: string }[];
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      activeBuildingId: string;
      activeRole: string;
      buildings: { id: string; name: string; role: string }[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    activeBuildingId: string;
    activeRole: string;
    buildings: { id: string; name: string; role: string }[];
  }
}
```

- [ ] **Step 2: Update auth-options.ts**

In the `authorize` callback:
- After finding user, query `UserBuilding` for all buildings
- Pick the first building as active (or from cookie)
- Return user with `activeBuildingId`, `activeRole`, `buildings`

In the JWT callback:
- Store `activeBuildingId`, `activeRole`, `buildings` in token

In the session callback:
- Expose `activeBuildingId`, `activeRole`, `buildings` on session.user

- [ ] **Step 3: Create building-context.ts**

```typescript
// src/lib/building-context.ts
import { cookies } from "next/headers";

const COOKIE_NAME = "active-building";

export function getActiveBuildingFromCookie(): string | null {
  const cookieStore = cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export function setActiveBuildingCookie(buildingId: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, buildingId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
```

- [ ] **Step 4: Create building switch API**

```typescript
// src/app/api/buildings/switch/route.ts
// POST { buildingId } — validates user belongs to building, sets cookie, returns new role
```

- [ ] **Step 5: Update getCurrentUser in auth.ts**

`getCurrentUser()` should return `{ id, email, name, activeBuildingId, activeRole, buildings }`.

- [ ] **Step 6: Update RBAC**

`hasMinimumRole` and `requireRole` keep the same interface — they use `activeRole` from the session. No changes needed to the functions themselves, only to where the role comes from (session instead of User.role).

- [ ] **Step 7: Update middleware.ts**

No changes needed — middleware already reads auth from session. The role is now `activeRole` from JWT.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(multi-building): phase 3a — auth with building context, switcher API, cookie"
```

---

## Task 4: Building Switcher UI

**Files:**
- Create: `src/components/layout/building-switcher.tsx`
- Create: `src/hooks/use-building.ts`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/hooks/use-auth.ts`
- Modify: `src/i18n/en.json`, `src/i18n/hu.json`

- [ ] **Step 1: Create building switcher component**

`src/components/layout/building-switcher.tsx`:
- "use client"
- Shows current building name + address at top of sidebar (replacing static app name)
- If user has multiple buildings: dropdown with all buildings
- On select: POST to /api/buildings/switch, then `router.refresh()`
- Single building: just shows the name, no dropdown

- [ ] **Step 2: Create use-building hook**

```typescript
// src/hooks/use-building.ts
export function useBuilding() {
  const { user } = useAuth();
  return {
    activeBuildingId: user?.activeBuildingId,
    activeRole: user?.activeRole,
    buildings: user?.buildings ?? [],
    hasMultipleBuildings: (user?.buildings?.length ?? 0) > 1,
  };
}
```

- [ ] **Step 3: Update sidebar**

Replace the static "Condo Manager" / "Társasházkezelő" header at top of sidebar with `<BuildingSwitcher />`. Match the Stitch Resident Dashboard design where building name is at the top left.

- [ ] **Step 4: Update use-auth hook**

Expose `activeBuildingId` and `activeRole` from session.

- [ ] **Step 5: Add i18n keys**

```json
"building": {
  "switchBuilding": "Switch Building",
  "selectBuilding": "Select Building",
  "noBuildings": "No buildings assigned",
  "buildings": "Buildings",
  "name": "Building Name",
  "address": "Address",
  "city": "City",
  "zipCode": "ZIP Code",
  "createBuilding": "Create Building",
  "editBuilding": "Edit Building",
  "deleteBuilding": "Delete Building",
  "manageBuildings": "Manage Buildings"
}
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(multi-building): building switcher in sidebar"
```

---

## Task 5: Scope All API Routes by Building

**Files:**
- Modify: ALL API route files listed in the file structure above

This is the largest task. Every API route that queries building-scoped data needs a `buildingId` filter added.

- [ ] **Step 1: Create a helper to get buildingId from session**

Add to `src/lib/auth.ts`:
```typescript
export async function requireBuildingContext(): Promise<{ userId: string; buildingId: string; role: string }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (!user.activeBuildingId) throw new Error("No building selected");
  return { userId: user.id, buildingId: user.activeBuildingId, role: user.activeRole };
}
```

- [ ] **Step 2: Update Communication API routes**

- `announcements/route.ts`: GET adds `where.buildingId`, POST adds `buildingId` to create
- `forum/categories/route.ts`: GET adds `where.buildingId`, POST adds `buildingId`
- `forum/topics/route.ts`: filter by category.buildingId
- `complaints/route.ts`: GET adds `where.buildingId`, POST adds `buildingId`

- [ ] **Step 3: Update Finance API routes**

- `finance/accounts/route.ts`: filter by `buildingId`
- `finance/summary/route.ts`: filter accounts by `buildingId`
- `finance/ledger/route.ts`: filter via account.buildingId
- `finance/budget/route.ts`: filter via account.buildingId
- `finance/charges/route.ts`: filter via Unit.buildingId
- `finance/import/route.ts`: validate accounts belong to building

- [ ] **Step 4: Update Maintenance API routes**

- `maintenance/tickets/route.ts`: GET/POST add `buildingId`
- `maintenance/scheduled/route.ts`: GET/POST add `buildingId`
- Contractors stay global (no buildingId filter)

- [ ] **Step 5: Update Voting API routes**

- `voting/meetings/route.ts`: GET/POST add `buildingId`
- `voting/votes/route.ts`: filter via meeting.buildingId or direct buildingId

- [ ] **Step 6: Update Documents API routes**

- `documents/categories/route.ts`: GET/POST add `buildingId`
- `documents/route.ts`: filter via category.buildingId

- [ ] **Step 7: Update Users API route**

- `users/route.ts`: GET lists users for active building (join UserBuilding). POST creates UserBuilding + UnitUser instead of setting User.unitId/role.
- `users/[id]/route.ts`: PATCH updates UserBuilding.role, UnitUser associations

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(multi-building): phase 3b — scope all API routes by active building"
```

---

## Task 6: Update Dashboard and Components

**Files:**
- Modify: `src/components/dashboard/resident-dashboard.tsx`
- Modify: `src/components/dashboard/admin-dashboard.tsx`
- Modify: `src/components/admin/user-list.tsx`
- Modify: `src/components/admin/user-form.tsx`
- Modify: `src/components/settings/profile-tab.tsx`

- [ ] **Step 1: Update dashboards**

Dashboard data already comes from API routes which are now building-scoped. Just add the building name in the header.

- [ ] **Step 2: Update user management**

- User list: show users for active building (from UserBuilding)
- User form: create UserBuilding + UnitUser instead of setting role/unitId on User
- Show user's units in the building
- Allow assigning multiple units per user

- [ ] **Step 3: Update settings/profile**

- Show all buildings the user belongs to with role and units per building

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(multi-building): update dashboards and user management for building context"
```

---

## Task 7: Building Admin Page

**Files:**
- Create: `src/app/[locale]/admin/buildings/page.tsx`
- Create: `src/components/admin/building-list.tsx`
- Create: `src/app/api/buildings/route.ts`
- Create: `src/app/api/buildings/[id]/route.ts`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create Buildings API**

- GET /api/buildings: SUPER_ADMIN sees all, others see their own
- POST /api/buildings: SUPER_ADMIN only, create new building
- PATCH /api/buildings/[id]: SUPER_ADMIN only, update name/address
- DELETE /api/buildings/[id]: SUPER_ADMIN only (fail if has units)

- [ ] **Step 2: Create Buildings admin page**

Table showing all buildings: name, address, city, unit count, user count. Create/edit modal. Delete button (only if empty).

SUPER_ADMIN only — add to sidebar under admin section.

- [ ] **Step 3: Add sidebar link**

Add "Buildings" to admin section of sidebar (SUPER_ADMIN only).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(multi-building): building management admin page"
```

---

## Task 8: Drop Old Columns (Phase 4)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Make buildingId non-nullable on all models**

Change all `buildingId String?` to `buildingId String` and `Building?` to `Building`.

- [ ] **Step 2: Remove old fields from User model**

Remove:
- `role Role @default(RESIDENT)`
- `unit Unit @relation(fields: [unitId], references: [id])`
- `unitId String`
- `isPrimaryContact Boolean @default(false)`

Remove the old `Role` enum (keep `BuildingRole`).

- [ ] **Step 3: Remove `users User[]` from Unit model**

The old direct relation is replaced by `unitUsers UnitUser[]`.

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name finalize-multi-building
```

- [ ] **Step 5: Clean up any remaining references to old fields**

Grep for `user.role`, `user.unitId`, `user.isPrimaryContact`, `User.role` across the codebase and fix any remaining references.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(multi-building): phase 4 — drop old columns, finalize schema"
```

---

## Task 9: Tests and Verification

**Files:**
- Modify: `tests/lib/rbac.test.ts`
- Create: `tests/lib/building-context.test.ts`
- Modify: `e2e/auth.spec.ts`

- [ ] **Step 1: Update RBAC tests**

Update existing tests to work with BuildingRole enum instead of Role.

- [ ] **Step 2: Add building context tests**

Test: building switcher sets cookie, role resolves correctly per building, user with multiple buildings can switch.

- [ ] **Step 3: Update E2E tests**

Login tests should work with the new auth flow.

- [ ] **Step 4: Verify build**

```bash
npm run build
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git commit -m "test: update tests for multi-building migration"
```

---

## Task 10: Redeploy to Server

- [ ] **Step 1: Push to GitHub and merge**
- [ ] **Step 2: SSH to server, pull, rebuild, migrate**

```bash
ssh zoli@100.86.236.18
cd ~/condo-manager
git pull
docker compose build
docker compose up -d
# Run migration via temp container (same pattern as initial deploy)
```

- [ ] **Step 3: Run data migration on server**

```bash
# Use temp container to run the data migration script
docker run --rm --network condo-manager_default \
  -e DATABASE_URL="postgresql://condo:condo_secret@db:5432/condo_manager" \
  -v $(pwd)/prisma:/app/prisma \
  -w /app \
  node:22-alpine \
  sh -c "npm install prisma@6 @prisma/client@6 tsx --no-save && npx prisma migrate deploy && npx tsx prisma/migrate-to-multi-building.ts"
```

- [ ] **Step 4: Verify app works**

---

## Summary

| Task | Phase | Description | Commit |
|------|-------|-------------|--------|
| 1 | Phase 1 | Add new tables, buildingId columns (nullable) | Schema addition |
| 2 | Phase 2 | Data migration script + multi-building seed | Data migration |
| 3 | Phase 3a | Auth with building context, cookie, switch API | Auth update |
| 4 | Phase 3b | Building switcher UI in sidebar | UI component |
| 5 | Phase 3c | Scope ALL API routes by active building | API scoping |
| 6 | Phase 3d | Update dashboards, user management, settings | Component updates |
| 7 | Phase 3e | Building admin page (SUPER_ADMIN) | New feature |
| 8 | Phase 4 | Drop old columns, finalize schema | Schema cleanup |
| 9 | — | Tests and verification | Testing |
| 10 | — | Redeploy to server | Deployment |
