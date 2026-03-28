# Multi-Building Migration — Design Specification

## Overview

Migrate the Condo Manager from a single-building model to multi-building support. Users can own/manage units across multiple buildings. Roles are per-building. A building switcher in the sidebar lets users switch context.

## Data Model Changes

### New Models

```prisma
model Building {
  id        String   @id @default(cuid())
  name      String
  address   String
  city      String
  zipCode   String
  units     Unit[]
  userBuildings UserBuilding[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

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
}
```

### Modified Models

**Unit** — add building reference:
```prisma
model Unit {
  // existing fields...
  building   Building @relation(fields: [buildingId], references: [id])
  buildingId String
  unitUsers  UnitUser[]
  // remove: users User[] (old direct relation)
}
```

**User** — remove direct unit/role fields:
```prisma
model User {
  // keep: id, email, passwordHash, name, language, notificationPreferences, isActive, createdAt, updatedAt
  // remove: role, unitId, isPrimaryContact
  // add:
  userBuildings UserBuilding[]
  unitUsers     UnitUser[]
}
```

### Removed

- `Role` enum on User model (replaced by `BuildingRole` on `UserBuilding`)
- `User.unitId` (replaced by `UnitUser` junction table)
- `User.isPrimaryContact` (moved to `UnitUser.isPrimaryContact`)
- `User.role` (moved to `UserBuilding.role`)

## Session & Auth

### JWT Token Contents

```typescript
{
  id: string;           // user ID
  email: string;
  name: string;
  activeBuildingId: string;  // currently selected building
  activeRole: string;        // role in active building
}
```

### Building Context Flow

1. User logs in → query UserBuilding to find their buildings
2. If only one building → auto-select it
3. If multiple → use last-selected (stored in cookie) or first one
4. JWT stores `activeBuildingId` and `activeRole`
5. Building switcher updates the cookie and refreshes the session

### Role Resolution

```typescript
// Get user's role for the active building
const userBuilding = await prisma.userBuilding.findUnique({
  where: { userId_buildingId: { userId, buildingId: activeBuildingId } }
});
const role = userBuilding.role; // ADMIN, BOARD_MEMBER, etc.
```

## Building Scoping

### Per-Building (filtered by activeBuildingId)

| Module | Models Scoped |
|--------|--------------|
| Communication | Announcement, ForumCategory, ForumTopic, ForumReply, Complaint, ComplaintNote |
| Finance | Account, LedgerEntry, MonthlyCharge, Budget |
| Maintenance | MaintenanceTicket, TicketComment, TicketAttachment, ScheduledMaintenance |
| Voting | Meeting, MeetingRsvp, Vote, VoteOption, Ballot, ProxyAssignment |
| Documents | DocumentCategory, Document, DocumentVersion |

Each of these models needs a `buildingId` field added, or inherits building scope through their parent (e.g., ForumTopic inherits from ForumCategory which has buildingId).

**Scoping strategy — add `buildingId` to root entities only:**
- Announcement → add buildingId
- ForumCategory → add buildingId (topics/replies inherit)
- Conversation → keep cross-building (users can message anyone they share a building with)
- Complaint → add buildingId
- Account → add buildingId (ledger entries, budgets inherit via account)
- MonthlyCharge → inherits via Unit.buildingId
- MaintenanceTicket → add buildingId
- ScheduledMaintenance → add buildingId
- Meeting → add buildingId (votes, ballots inherit)
- DocumentCategory → add buildingId (documents, versions inherit)

### Cross-Building

| Module | Reason |
|--------|--------|
| Direct Messages | Users can message anyone they share a building with |
| Notifications | User sees all notifications regardless of building |
| Contractors | Shared pool — property managers reuse across buildings |
| User Profile/Settings | Global per user |

## UI Changes

### Building Switcher

- Location: top of sidebar, replacing static app name
- Shows: building name, address snippet
- Dropdown: lists all buildings the user belongs to
- Switching: updates cookie + refreshes page
- Single building users: shows building name without dropdown

### Pages

**No new pages except:**
- `/admin/buildings` — SUPER_ADMIN only, CRUD for buildings (name, address, city, zipCode)

**Modified pages:**
- Dashboard — shows active building name in header
- User Management — manages users for active building (UserBuilding + UnitUser)
- All module pages — data filtered by active building (no visible change except building name)
- Settings/Profile — shows all buildings user belongs to with role and units per building

### User Management Changes

**Creating a user for a building:**
1. Create/find User by email
2. Create UserBuilding (assign role in this building)
3. Create UnitUser(s) (assign to unit(s) with relationship + primary contact)

**A user can exist in multiple buildings** — the admin of Building A sees and manages only that building's users.

## Migration Strategy

### Phase 1: Add New Tables (non-breaking)

- Create Building, UserBuilding, UnitUser tables
- Add `buildingId` to Unit as nullable
- Add `buildingId` to scoped root entities as nullable
- Keep existing User.unitId, User.role, User.isPrimaryContact working

### Phase 2: Migrate Data

```sql
-- 1. Create default building
INSERT INTO Building (id, name, address, city, zipCode) VALUES ('default', 'Default Building', '', '', '');

-- 2. Assign all units to default building
UPDATE Unit SET buildingId = 'default';

-- 3. Create UnitUser from existing User.unitId
INSERT INTO UnitUser (userId, unitId, relationship, isPrimaryContact)
SELECT id, unitId, CASE WHEN role = 'TENANT' THEN 'TENANT' ELSE 'OWNER' END, isPrimaryContact
FROM User WHERE unitId IS NOT NULL;

-- 4. Create UserBuilding from existing User.role
INSERT INTO UserBuilding (userId, buildingId, role)
SELECT id, 'default', role FROM User;

-- 5. Set buildingId on all scoped entities
UPDATE Announcement SET buildingId = 'default';
UPDATE ForumCategory SET buildingId = 'default';
UPDATE Complaint SET buildingId = 'default';
UPDATE Account SET buildingId = 'default';
UPDATE MaintenanceTicket SET buildingId = 'default';
UPDATE ScheduledMaintenance SET buildingId = 'default';
UPDATE Meeting SET buildingId = 'default';
UPDATE DocumentCategory SET buildingId = 'default';
```

### Phase 3: Update Application Code

- Auth: read role from UserBuilding, store activeBuildingId in session
- All API routes: add `buildingId` filter to queries
- Building switcher component
- Update RBAC to use UserBuilding.role
- Update all components to use new data sources

### Phase 4: Drop Old Columns

- Make Unit.buildingId non-nullable
- Make all scoped entity buildingId fields non-nullable
- Drop User.unitId, User.role, User.isPrimaryContact
- Drop old Role enum

## Seed Data Update

```typescript
// Create two buildings
const building1 = await prisma.building.create({
  data: { name: "Duna Residence", address: "Fő utca 12", city: "Budapest", zipCode: "1011" }
});
const building2 = await prisma.building.create({
  data: { name: "Margit Apartments", address: "Margit körút 45", city: "Budapest", zipCode: "1024" }
});

// Assign existing units to building1
// Create a few units in building2
// Create UserBuilding entries for each user
// Create UnitUser entries
```
