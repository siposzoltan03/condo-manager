# Next.js App Router Refactoring Plan — Condo Manager

## Context

The condo-manager project uses Next.js 15 with the App Router but follows patterns from the Pages Router era. Nearly 100% of components are marked `"use client"`, all data fetching happens client-side via `useEffect` + `fetch()` to API routes, and there are no Server Actions, no `loading.tsx`/`error.tsx` boundaries, and no per-page metadata. This results in:

- **Larger client JS bundles** than necessary
- **Client-side loading waterfalls** (page loads → JS loads → fetch fires → data renders)
- **No streaming/Suspense** — users see blank states or spinners
- **Hydration issues** — server/client state mismatches (already encountered)
- **Unnecessary API round-trips** — server components could query the DB directly

This plan incrementally refactors toward App Router best practices while keeping the app functional at every step.

---

## Phase 1: Infrastructure — Error/Loading Boundaries + Metadata

**Goal:** Add the missing Next.js file conventions that improve UX immediately with minimal risk.

### 1.1 Add `loading.tsx` files for route-level Suspense

Create `loading.tsx` in key route segments to show instant loading states:

```
src/app/[locale]/dashboard/loading.tsx
src/app/[locale]/units/loading.tsx
src/app/[locale]/users/loading.tsx
src/app/[locale]/complaints/loading.tsx
src/app/[locale]/finance/loading.tsx
src/app/[locale]/announcements/loading.tsx
src/app/[locale]/messages/loading.tsx
src/app/[locale]/voting/loading.tsx
src/app/[locale]/documents/loading.tsx
src/app/[locale]/maintenance/loading.tsx
```

Each exports a skeleton/spinner matching the page layout. This replaces component-level loading states.

### 1.2 Add `error.tsx` boundary

Create `src/app/[locale]/error.tsx` — a single client-component error boundary that catches unhandled errors across all authenticated routes. Shows a retry button and error message.

### 1.3 Add `not-found.tsx`

Create `src/app/[locale]/not-found.tsx` for 404 states (e.g., complaint detail with invalid ID).

### 1.4 Add per-page metadata with `generateMetadata`

Add `generateMetadata()` to dynamic detail pages:

- `src/app/[locale]/complaints/[id]/page.tsx`
- `src/app/[locale]/maintenance/[id]/page.tsx`
- `src/app/[locale]/voting/[id]/page.tsx`

And static metadata exports to list pages:

- `src/app/[locale]/units/page.tsx` — `{ title: "Unit Management" }`
- `src/app/[locale]/users/page.tsx` — `{ title: "User Management" }`
- etc.

---

## Phase 2: Server-First Data Fetching (The Big Win)

**Goal:** Move initial data fetching from client components into server components. This is the highest-impact change — eliminates the client-side fetch waterfall.

### Pattern: Server Component fetches → passes data as props to Client Component

**Before (current):**
```
page.tsx (server, empty) → <UnitList /> ("use client", fetches in useEffect)
```

**After:**
```
page.tsx (server, fetches data) → <UnitListClient initialData={data} /> ("use client", only for interactivity)
```

### 2.1 Create a Data Access Layer (DAL)

Create `src/lib/dal.ts` — server-only functions that fetch data directly via Prisma (no HTTP round-trip). Reuse existing auth helpers.

```typescript
// src/lib/dal.ts
import "server-only";
import { cache } from "react";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const getUnits = cache(async () => {
  const { buildingId } = await requireBuildingContext();
  // ... same query as GET /api/units but direct
});

export const getComplaints = cache(async (params) => { ... });
export const getUsers = cache(async (params) => { ... });
```

Key files to reference for query logic:
- `src/app/api/units/route.ts` (GET handler)
- `src/app/api/users/route.ts` (GET handler)
- `src/app/api/complaints/route.ts` (GET handler)
- `src/lib/auth.ts` (`requireBuildingContext`)
- `src/lib/rbac.ts` (`requireRole`, `hasMinimumRole`)

### 2.2 Refactor pages to fetch server-side

Convert pages one at a time. Priority order (by traffic/impact):

1. **Dashboard** — `src/app/[locale]/dashboard/page.tsx`
2. **Units** — `src/app/[locale]/units/page.tsx`
3. **Users** — `src/app/[locale]/users/page.tsx`
4. **Complaints** — `src/app/[locale]/complaints/page.tsx`
5. **Announcements** — `src/app/[locale]/announcements/page.tsx`
6. **Finance** — `src/app/[locale]/finance/page.tsx`
7. **Maintenance** — `src/app/[locale]/maintenance/page.tsx`
8. **Voting** — `src/app/[locale]/voting/page.tsx`
9. **Documents** — `src/app/[locale]/documents/page.tsx`
10. **Messages** — `src/app/[locale]/messages/page.tsx` (keep client-side for polling/real-time)

For each page:
- Page fetches data via DAL function
- Page passes `initialData` to the client component
- Client component initializes state from props instead of fetching on mount
- Client component still handles refresh/refetch after mutations
- **API routes are kept** — still needed for client-side refetches after create/edit/delete

### 2.3 Split large client components

Break monolithic `"use client"` components into:
- **Server part** (data display, static UI) — stays in page or a server component
- **Client part** (search, filters, modals, delete actions) — minimal `"use client"` leaf

Example for units:
```
page.tsx (server) — fetches units, renders table structure
  └─ <UnitTableActions /> ("use client") — edit/delete buttons, modal
  └─ <UnitSearchBar /> ("use client") — search input with debounce
```

This pushes `"use client"` to the leaves, reducing the client bundle.

---

## Phase 3: Server Actions for Mutations

**Goal:** Replace client-side `fetch()` POST/PATCH/DELETE calls with Server Actions for form submissions.

### 3.1 Create Server Actions

Create `src/app/actions/` directory with action files:

```
src/app/actions/units.ts      — createUnit, updateUnit, deleteUnit
src/app/actions/users.ts      — createUser, updateUser, toggleUserActive
src/app/actions/complaints.ts — createComplaint, updateComplaintStatus
```

Each action:
- Starts with `"use server"`
- Validates input (reuse existing validation from API routes)
- Calls `requireBuildingContext()` + `requireRole()`
- Calls `requireNotFrozen()` for write operations
- Creates audit logs
- Calls `revalidatePath()` to refresh the page data
- Returns `{ success: true }` or `{ error: "message" }`

### 3.2 Update form components to use Server Actions

Update `unit-form.tsx`, `user-form.tsx`, `complaint-form.tsx` etc. to call Server Actions instead of `fetch()`. Use `useActionState` for pending/error states.

### 3.3 Keep API routes

**Do NOT delete API routes.** They're still needed for:
- Client-side refetches (search, pagination, filters)
- The mobile app / external consumers (future)
- Webhook endpoints

---

## Phase 4: Auth Improvements

**Goal:** Move auth closer to the data, reduce client-side auth checks.

### 4.1 Server-side role checking in pages

Replace `<RoleGuard>` client component with server-side checks in `page.tsx`:

```typescript
// Before
export default async function UnitsPage() {
  return <RoleGuard role="ADMIN"><UnitList /></RoleGuard>;
}

// After
export default async function UnitsPage() {
  const { role } = await requireBuildingContext();
  await requireRole(role, "ADMIN"); // throws → caught by error.tsx
  const data = await getUnits();
  return <UnitListClient initialData={data} />;
}
```

The middleware already redirects unauthenticated users. Server-side role checks in pages are faster and don't flash unauthorized content.

### 4.2 Add `server-only` to sensitive modules

Add `import "server-only"` to:
- `src/lib/auth.ts`
- `src/lib/prisma.ts`
- `src/lib/audit.ts`
- `src/lib/dal.ts` (new)

This prevents accidental import into client components.

---

## Phase 5: Cleanup

### 5.1 Evaluate `force-dynamic` on root layout

`src/app/[locale]/layout.tsx` has `export const dynamic = "force-dynamic"` which disables all caching. Investigate if this can be moved to individual pages that need it (auth-dependent pages) while allowing public pages (pricing, landing) to be statically cached.

### 5.2 Remove unused auth branches from public components

Already partially done (PublicNav). Verify no other public components call `useAuth()` or `useSession()` unnecessarily.

### 5.3 Consider `next/font` for Manrope/Inter

If not already using `next/font`, switch from Google Fonts CDN to Next.js font optimization to eliminate layout shift and external requests.

---

## Implementation Order

| Step | Phase | Risk | Impact |
|------|-------|------|--------|
| 1 | 1.1 loading.tsx files | Low | Medium — instant perceived performance |
| 2 | 1.2-1.3 error/not-found | Low | Medium — graceful error handling |
| 3 | 1.4 metadata | Low | Low — SEO improvement |
| 4 | 2.1 DAL creation | Low | Foundation for Phase 2 |
| 5 | 2.2 Units page server-fetch | Medium | High — template for all pages |
| 6 | 2.2 Remaining pages | Medium | High — eliminate waterfalls |
| 7 | 4.1 Server-side role checks | Low | Medium — remove RoleGuard flicker |
| 8 | 4.2 server-only imports | Low | Low — safety net |
| 9 | 3.1-3.2 Server Actions | Medium | Medium — cleaner mutations |
| 10 | 2.3 Component splitting | High | Medium — smaller bundles |
| 11 | 5.x Cleanup | Low | Low |

---

## Verification

After each phase:
1. `npx tsc --noEmit` — no type errors
2. `npm run build` — successful production build
3. Manual testing — pages load, data displays, forms submit
4. Check browser DevTools Network tab — verify server-side fetches (no unnecessary client API calls on initial load)
5. Check page source — verify data is in the HTML (SSR working)

---

## What We're NOT Doing

- **Not rewriting everything at once** — incremental, page-by-page migration
- **Not deleting API routes** — still needed for client-side interactions
- **Not adding a caching layer yet** — get the basics right first
- **Not converting Messages to server-fetch** — needs real-time polling, stays client-side
- **Not introducing new libraries** — using built-in Next.js/React features only
