# Unit Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full unit CRUD with ownership share management, so admins can create/edit units and set voting weights.

**Architecture:** Units are the core entity linking residents to buildings. Each unit has an ownership share (0-100%) used for weighted voting. The total ownership across all units in a building should sum to 100%. Unit management is accessible to ADMIN+ users.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, Tailwind CSS, lucide-react, next-intl

---

## Context: Where Units Are Used

| Module | How Units Are Used |
|--------|-------------------|
| **User Management** | Assign users to units via dropdown (already works) |
| **Invitations** | Optionally pre-assign unit during invite (already works) |
| **Voting** | Ballot weight = unit's `ownershipShare` |
| **Finance** | Monthly charges linked per unit |
| **Quorum** | Sum of voting unit weights vs total ownership |

**What's missing:** No UI to create, edit, or delete units. No way to manage ownership shares. Units are only created via seed script.

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── units/
│   │       ├── route.ts                    # MODIFY: enhance GET, add POST
│   │       └── [id]/
│   │           └── route.ts                # NEW: GET detail, PATCH, DELETE
│   └── [locale]/
│       └── units/
│           └── page.tsx                    # NEW: unit management page
├── components/
│   └── units/
│       ├── unit-list.tsx                   # NEW: table with summary bar
│       └── unit-form.tsx                   # NEW: create/edit modal
└── i18n/
    ├── en.json                             # ADD: units.* keys
    └── hu.json                             # ADD: units.* keys
```

---

## Task 1: Enhance Units API

**Files:**
- Modify: `src/app/api/units/route.ts`
- Create: `src/app/api/units/[id]/route.ts`

### GET /api/units (enhance existing)

Currently returns `{ id, number, floor }`. Enhance to return:
```typescript
{
  id, number, floor, size, ownershipShare,
  _count: { unitUsers: number },
  primaryContact: { name: string } | null,
  residentCount: number
}
```

Include building's total ownership share in response metadata:
```typescript
{ units: [...], totalOwnershipShare: 0.95, buildingName: "..." }
```

### POST /api/units (new)

- ADMIN+ only
- Body: `{ number, floor, size, ownershipShare }`
- `ownershipShare` sent as percentage (0-100), stored as decimal (0-1)
- Validate: number unique within building (@@unique([buildingId, number]))
- Check unit limit: `checkUnitLimit(buildingId)`
- Audit log
- Return created unit

### GET /api/units/[id] (new)

- ADMIN+ only
- Return unit with all fields + assigned users (UnitUser with user name, role, relationship, isPrimaryContact)
- Verify unit belongs to active building

### PATCH /api/units/[id] (new)

- ADMIN+ only
- Body: `{ number?, floor?, size?, ownershipShare? }`
- Validate number uniqueness if changed
- `ownershipShare` sent as percentage, stored as decimal
- Audit log with old/new values
- Return updated unit

### DELETE /api/units/[id] (new)

- ADMIN+ only
- Fail with 409 if unit has assigned users (UnitUser records exist) — must reassign users first
- Fail with 409 if unit has unpaid monthly charges
- Audit log
- Return success

**Commit:** `feat(units): enhance units API with full CRUD and ownership share management`

---

## Task 2: Unit List Page + Components

**Files:**
- Create: `src/app/[locale]/units/page.tsx`
- Create: `src/components/units/unit-list.tsx`
- Create: `src/components/units/unit-form.tsx`

### Unit List Page (`src/app/[locale]/units/page.tsx`)

Server page with locale support. Renders `<UnitList />`.

### Unit List Component (`src/components/units/unit-list.tsx`)

"use client" component.

**Summary bar** (3 cards):
- Total Units: count
- Total Ownership: percentage (green if ~100%, amber if != 100%, red if > 100%)
- Average Size: m²

**Table columns:**
| Column | Description |
|--------|-------------|
| Unit Number | e.g. "1A", "2B" — sortable |
| Floor | Integer |
| Size | m² with decimal |
| Ownership Share | Percentage + small progress bar (bg-[#002045]) |
| Primary Contact | Name or "—" |
| Residents | Count badge |
| Actions | Edit button, Delete button (disabled if has users) |

**Design:**
- Same table style as user-list.tsx: rounded-xl border, bg-white, hover rows
- Summary cards: similar to finance summary cards (bg-white, rounded-xl, icon + label + value)
- Ownership share column: show percentage text + thin horizontal bar (width proportional to share)
- Total ownership warning: if != 100%, show amber/red banner above table

### Unit Form Modal (`src/components/units/unit-form.tsx`)

"use client" modal component.

**Fields:**
- Unit Number (text input, required) — e.g. "1A", "3B"
- Floor (number input, required) — 0 = ground floor
- Size m² (number input, required) — e.g. 65.5
- Ownership Share % (number input, required) — e.g. 6.25

**Validation:**
- All fields required
- Ownership share: 0-100 range
- Show calculated warning: "Current total: X%. Adding this unit would make it Y%." in amber if > 100%

**Modes:**
- Create: POST /api/units
- Edit: PATCH /api/units/[id], pre-filled with current values

**Stitch design reference (when available):**
- Create matching design in Stitch: table with ownership bars, summary cards, edit modal with percentage input

**Commit:** `feat(units): unit management page with ownership share tracking`

---

## Task 3: Sidebar + Navigation

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/hu.json`

### Sidebar

Add "Units" nav item:
- Icon: `Building2` or `DoorOpen` from lucide-react
- Href: `/units`
- Minimum role: ADMIN
- Position: after "Users" in the nav order

### i18n Keys

Add to both locale files under `units.*`:

**English:**
```json
"units": {
  "title": "Unit Management",
  "addUnit": "Add Unit",
  "editUnit": "Edit Unit",
  "deleteUnit": "Delete Unit",
  "unitNumber": "Unit Number",
  "floor": "Floor",
  "size": "Size (m²)",
  "ownershipShare": "Ownership Share",
  "ownershipPercent": "Ownership %",
  "primaryContact": "Primary Contact",
  "residents": "Residents",
  "totalUnits": "Total Units",
  "totalOwnership": "Total Ownership",
  "averageSize": "Average Size",
  "ownershipWarning": "Total ownership share is not 100%",
  "ownershipOver": "Total ownership exceeds 100%",
  "ownershipOk": "Ownership shares sum to 100%",
  "confirmDelete": "Are you sure you want to delete this unit?",
  "unitHasUsers": "Cannot delete: unit has assigned users. Reassign them first.",
  "unitHasCharges": "Cannot delete: unit has unpaid charges.",
  "noUnits": "No units in this building",
  "numberPlaceholder": "e.g. 1A",
  "floorPlaceholder": "e.g. 0 (ground)",
  "sizePlaceholder": "e.g. 65.5",
  "ownershipPlaceholder": "e.g. 6.25",
  "currentTotal": "Current total",
  "afterAdding": "After adding"
}
```

**Hungarian:**
```json
"units": {
  "title": "Lakások kezelése",
  "addUnit": "Lakás hozzáadása",
  "editUnit": "Lakás szerkesztése",
  "deleteUnit": "Lakás törlése",
  "unitNumber": "Lakásszám",
  "floor": "Emelet",
  "size": "Méret (m²)",
  "ownershipShare": "Tulajdoni hányad",
  "ownershipPercent": "Tulajdoni %",
  "primaryContact": "Kapcsolattartó",
  "residents": "Lakók",
  "totalUnits": "Összes lakás",
  "totalOwnership": "Összes tulajdoni hányad",
  "averageSize": "Átlagos méret",
  "ownershipWarning": "A tulajdoni hányadok összege nem 100%",
  "ownershipOver": "A tulajdoni hányadok összege meghaladja a 100%-ot",
  "ownershipOk": "A tulajdoni hányadok összege 100%",
  "confirmDelete": "Biztosan törölni szeretné ezt a lakást?",
  "unitHasUsers": "Nem törölhető: a lakáshoz felhasználók vannak hozzárendelve. Először rendelje át őket.",
  "unitHasCharges": "Nem törölhető: a lakásnak kifizetetlen díjai vannak.",
  "noUnits": "Nincsenek lakások ebben az épületben",
  "numberPlaceholder": "pl. 1A",
  "floorPlaceholder": "pl. 0 (földszint)",
  "sizePlaceholder": "pl. 65.5",
  "ownershipPlaceholder": "pl. 6.25",
  "currentTotal": "Jelenlegi összesen",
  "afterAdding": "Hozzáadás után"
}
```

**Commit:** `feat(units): add sidebar navigation and i18n for unit management`

---

## Task 4: Stitch Designs (requires Stitch MCP)

Create in Stitch project `12492868757243512015`:

1. **Unit List page** — table with ownership share progress bars, summary cards, add button
2. **Unit Edit modal** — form with ownership percentage input and total warning

These designs should be created when Stitch MCP is available.

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Enhanced units API with full CRUD | API endpoints |
| 2 | Unit list page + form components | UI components |
| 3 | Sidebar nav + i18n | Navigation |
| 4 | Stitch designs | When MCP available |
