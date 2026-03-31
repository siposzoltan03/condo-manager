# Subscriptions, Invitations & Feature Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Subscription, Plan, and Invitation models with a complete invitation flow, feature gating library, and gated sidebar navigation.

**Architecture:** A `Subscription` entity owns buildings and links to a `Plan` that defines limits and feature flags. Feature gating is enforced at the API level via a `requireFeature()` helper and at the UI level via disabled sidebar items with plan badges. Invitations use SHA-256 hashed tokens with configurable expiry per building.

**Tech Stack:** Prisma, PostgreSQL, Next.js 15, NextAuth v5, next-intl, bcryptjs, crypto (Node built-in)

**Spec:** `docs/superpowers/specs/2026-03-30-subscription-plans-and-invitations-design.md`

---

## File Structure — What Changes

```
prisma/
├── schema.prisma                                    # Add enums, Plan, Subscription, Invitation models; modify Building, User
├── migrations/                                      # New migration
└── seed.ts                                          # Add plan seeding + legacy subscription for existing data

src/
├── lib/
│   ├── feature-gate.ts                              # NEW: requireFeature() helper
│   ├── plan-limits.ts                               # NEW: checkBuildingLimit(), checkUnitLimit()
│   └── invitation.ts                                # NEW: token generation, hashing, validation helpers
├── app/
│   ├── api/
│   │   ├── invitations/
│   │   │   └── route.ts                             # NEW: POST (send invite), GET (list for building)
│   │   ├── invitations/[token]/
│   │   │   ├── accept/route.ts                      # NEW: POST (public, rate-limited)
│   │   │   └── validate/route.ts                    # NEW: GET (public, returns pre-filled data)
│   │   ├── invitations/[id]/
│   │   │   ├── revoke/route.ts                      # NEW: PATCH (admin)
│   │   │   └── resend/route.ts                      # NEW: POST (admin)
│   │   ├── subscription/
│   │   │   ├── route.ts                             # NEW: GET current subscription + plan
│   │   │   └── usage/route.ts                       # NEW: GET usage vs limits
│   │   └── admin/subscriptions/[id]/
│   │       └── plan/route.ts                        # NEW: POST manual plan override (SUPER_ADMIN)
│   └── [locale]/
│       ├── accept-invitation/
│       │   └── [token]/
│       │       └── page.tsx                         # NEW: public accept invitation page
│       └── settings/
│           └── invitations/
│               └── page.tsx                         # NEW: invitation management (admin)
├── components/
│   ├── layout/
│   │   └── sidebar.tsx                              # MODIFY: add feature gating + plan badges
│   ├── settings/
│   │   └── invitation-list.tsx                      # NEW: invitation table with actions
│   └── shared/
│       └── upgrade-modal.tsx                        # NEW: modal for gated feature click
├── hooks/
│   └── use-plan-features.ts                         # NEW: hook to load plan features for UI gating
├── i18n/
│   ├── en.json                                      # Add invitation.*, plan.*, featureGate.* keys
│   └── hu.json                                      # Add invitation.*, plan.*, featureGate.* keys
└── types/
    └── next-auth.d.ts                               # Add subscriptionId to session type
```

---

## Task 1: Schema — Add Enums, Plan, Subscription, Invitation Models

**Files:**
- Modify: `prisma/schema.prisma`

**Steps:**

- [ ] Add `SubscriptionStatus` enum with values: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`
- [ ] Add `InvitationType` enum with values: `ADMIN_SETUP`, `USER_INVITE`
- [ ] Add `InvitationStatus` enum with values: `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`
- [ ] Add `Plan` model:
  - `id` (String, cuid, @id)
  - `name` (String) — display name
  - `slug` (String, @unique) — URL-safe identifier
  - `stripePriceId` (String?) — Stripe price reference
  - `maxBuildings` (Int) — -1 for unlimited
  - `maxUnitsPerBuilding` (Int) — -1 for unlimited
  - `features` (Json) — array of feature flag strings
  - `priceMonthly` (Decimal, @db.Decimal(10, 2))
  - `priceYearly` (Decimal, @db.Decimal(10, 2))
  - `trialDays` (Int, @default(14))
  - `isActive` (Boolean, @default(true))
  - `createdAt` (DateTime, @default(now()))
  - Relations: `subscriptions Subscription[]`
- [ ] Add `Subscription` model:
  - `id` (String, cuid, @id)
  - `name` (String) — company/account name
  - `email` (String) — billing contact
  - `stripeCustomerId` (String?) — unique if set
  - `stripeSubscriptionId` (String?) — unique if set
  - `planId` (String) — FK to Plan
  - `plan` (Plan, @relation)
  - `trialEndsAt` (DateTime?)
  - `subscriptionStatus` (SubscriptionStatus)
  - `ownerId` (String) — FK to User
  - `owner` (User, @relation("SubscriptionOwner"))
  - `createdAt`, `updatedAt`
  - Relations: `buildings Building[]`, `invitations Invitation[]`
  - Indexes: `@@index([ownerId])`, `@@index([subscriptionStatus])`
- [ ] Add `Invitation` model:
  - `id` (String, cuid, @id)
  - `email` (String)
  - `tokenHash` (String, @unique) — SHA-256 hash
  - `type` (InvitationType)
  - `role` (BuildingRole?) — required for USER_INVITE
  - `unitId` (String?) — optional FK to Unit
  - `relationship` (UnitRelationship?) — OWNER or TENANT
  - `buildingId` (String?) — FK to Building, nullable for ADMIN_SETUP
  - `subscriptionId` (String?) — FK to Subscription, for ADMIN_SETUP
  - `invitedById` (String?) — FK to User, null for system invitations
  - `expiresAt` (DateTime)
  - `acceptedAt` (DateTime?)
  - `status` (InvitationStatus, @default(PENDING))
  - `createdAt`, `updatedAt`
  - Relations: `building Building?`, `subscription Subscription?`, `invitedBy User?`, `unit Unit?`
  - Indexes: `@@index([email])`, `@@index([buildingId])`, `@@index([status])`
- [ ] Modify `Building` model:
  - Add `subscriptionId` (String?) — optional during migration
  - Add `subscription` (Subscription?, @relation)
  - Add `invitationExpiryHours` (Int, @default(168)) — 7 days default
  - Add `invitations Invitation[]`
- [ ] Modify `User` model:
  - Add `ownedSubscriptions Subscription[]` (@relation("SubscriptionOwner"))
  - Add `sentInvitations Invitation[]` (@relation("InvitationSender"))
- [ ] Add relation name `"InvitationSender"` on Invitation.invitedBy
- [ ] Run `npx prisma migrate dev --name add-subscription-plan-invitation`
- [ ] Verify migration applies cleanly and existing data is preserved

**Commit:** `feat(schema): add Plan, Subscription, Invitation models with enums`

---

## Task 2: Seed Plans + Legacy Migration Data

**Files:**
- Modify: `prisma/seed.ts`

**Steps:**

- [ ] Add plan seed data at the top of `main()` (before building creation):
  ```typescript
  const legacyPlan = await prisma.plan.upsert({
    where: { slug: "legacy" },
    update: {},
    create: {
      name: "Legacy",
      slug: "legacy",
      maxBuildings: -1,
      maxUnitsPerBuilding: -1,
      features: JSON.stringify([
        "complaints", "announcements", "messaging", "documents",
        "finance", "voting", "maintenance", "forum",
        "api_access", "custom_branding", "audit_exports"
      ]),
      priceMonthly: 0,
      priceYearly: 0,
      trialDays: 0,
      isActive: false, // not available for new purchases
    },
  });
  ```
- [ ] Add Starter plan (slug: `starter`, 1 building, 30 units, features: `["complaints", "announcements", "messaging", "documents"]`)
- [ ] Add Professional plan (slug: `pro`, 5 buildings, 100 units, all Starter + `["finance", "voting", "maintenance", "forum"]`)
- [ ] Add Enterprise plan (slug: `enterprise`, -1 buildings, -1 units, all Pro + `["api_access", "custom_branding", "audit_exports"]`)
- [ ] Create a default Legacy subscription and assign it to the SUPER_ADMIN user:
  ```typescript
  const legacySubscription = await prisma.subscription.upsert({
    where: { id: "legacy-subscription" },
    update: {},
    create: {
      id: "legacy-subscription",
      name: "Legacy",
      email: superAdmin.email,
      planId: legacyPlan.id,
      subscriptionStatus: "ACTIVE",
      ownerId: superAdmin.id,
    },
  });
  ```
- [ ] Update building creation calls to include `subscriptionId: legacySubscription.id`
- [ ] Add cleanup for new tables in the correct FK order at the top: `prisma.invitation.deleteMany()`, `prisma.subscription.deleteMany()`, `prisma.plan.deleteMany()` — before building deletion
- [ ] Run `npx prisma db seed` and verify plans + subscription are created
- [ ] Verify existing buildings are linked to the legacy subscription

**Commit:** `feat(seed): add plan tiers and legacy subscription for existing data`

---

## Task 3: Feature Gating Library

**Files:**
- Create: `src/lib/feature-gate.ts`
- Create: `src/lib/plan-limits.ts`

**Steps:**

- [ ] Create `src/lib/feature-gate.ts`:
  - Export `async function getSubscriptionForBuilding(buildingId: string)` — loads building with subscription and plan
  - Export `async function requireFeature(buildingId: string, featureSlug: string)` — calls `getSubscriptionForBuilding`, checks if `plan.features` array includes `featureSlug`. If not, throws/returns `{ allowed: false, requiredPlan: string, message: string }`. Returns `{ allowed: true }` if feature is included.
  - Handle trial logic: if `subscriptionStatus === "TRIALING"` and `trialEndsAt > now()`, all features are allowed. If trial expired, fall back to plan features.
  - Handle missing subscription gracefully (legacy buildings without subscription should be allowed through)
  - Export `function featureToMinimumPlan(featureSlug: string)` — returns the minimum plan slug required ("starter", "pro", "enterprise") for use in UI badges

- [ ] Create `src/lib/plan-limits.ts`:
  - Export `async function checkBuildingLimit(subscriptionId: string)` — counts buildings under subscription vs `plan.maxBuildings`. Returns `{ allowed: boolean, current: number, max: number }`. -1 means unlimited.
  - Export `async function checkUnitLimit(buildingId: string)` — counts units in building vs `plan.maxUnitsPerBuilding`. Returns `{ allowed: boolean, current: number, max: number }`.

- [ ] Add JSDoc comments on all exported functions
- [ ] Verify TypeScript compilation passes

**Commit:** `feat(lib): add feature gating and plan limits helpers`

---

## Task 4: Invitation Token Helpers

**Files:**
- Create: `src/lib/invitation.ts`

**Steps:**

- [ ] Export `function generateInvitationToken()` — generates 32 random bytes, returns hex string using `crypto.randomBytes(32).toString("hex")`
- [ ] Export `function hashToken(token: string)` — returns SHA-256 hash using `crypto.createHash("sha256").update(token).digest("hex")`
- [ ] Export `async function findInvitationByToken(token: string)` — hashes the token, queries `prisma.invitation.findUnique({ where: { tokenHash } })` with includes for building, subscription
- [ ] Export `function isInvitationExpired(invitation: Invitation)` — checks `expiresAt < now()` or `status !== "PENDING"`
- [ ] Export `function getInvitationExpiryDate(building: Building | null, defaultHours?: number)` — uses building's `invitationExpiryHours` or default (168)

**Commit:** `feat(lib): add invitation token generation, hashing, and validation`

---

## Task 5: Invitation API Routes

**Files:**
- Create: `src/app/api/invitations/route.ts`
- Create: `src/app/api/invitations/[token]/accept/route.ts`
- Create: `src/app/api/invitations/[token]/validate/route.ts`
- Create: `src/app/api/invitations/[id]/revoke/route.ts`
- Create: `src/app/api/invitations/[id]/resend/route.ts`

**Steps:**

- [ ] `POST /api/invitations` (authenticated, ADMIN+):
  - Validate body: `email` (required), `role` (required, BuildingRole), `unitId` (optional), `relationship` (optional)
  - Check that the inviter has ADMIN+ role in the active building
  - Check for existing `UserBuilding` with this email + building — return 409 if already a member
  - Check for existing PENDING invitation with same email + building — return 409 with message to resend
  - Generate token, hash it, create `Invitation` record with type `USER_INVITE`
  - Set `expiresAt` using building's `invitationExpiryHours`
  - TODO: Queue email with invite link (email integration out of scope for this plan)
  - Return 201 with invitation data (excluding tokenHash)

- [ ] `GET /api/invitations` (authenticated, ADMIN+):
  - List invitations for the active building
  - Include `invitedBy` user name
  - Support query param `status` filter (PENDING, ACCEPTED, EXPIRED, REVOKED)
  - Order by `createdAt` desc

- [ ] `POST /api/invitations/[token]/accept` (public, rate-limited):
  - Apply rate limit: 5 attempts per IP per 15 minutes (use existing `src/lib/rate-limit.ts`)
  - Hash the token from URL, find invitation
  - Return 404 if not found, 410 if expired/revoked/accepted
  - Validate body: `name` (required), `password` (required, min 8 chars)
  - For `ADMIN_SETUP` type: also require `buildingName`, `buildingAddress`, `buildingCity`, `buildingZipCode`
  - In a transaction:
    - Create User with hashed password
    - For `ADMIN_SETUP`: create Building, link to subscription, create UserBuilding with ADMIN role
    - For `USER_INVITE`: create UserBuilding with invitation's role. If `unitId` set, create UnitUser with relationship.
    - Update invitation: set `status: ACCEPTED`, `acceptedAt: now()`
  - Return 200 with user data (excluding password)

- [ ] `GET /api/invitations/[token]/validate` (public):
  - Hash token, find invitation
  - Return 404 if not found, 410 if expired/revoked/accepted
  - Return 200 with: `email`, `type`, `role`, `buildingName` (if USER_INVITE), `unitNumber` (if unitId set)
  - Do NOT return sensitive data (tokenHash, invitedById, etc.)

- [ ] `PATCH /api/invitations/[id]/revoke` (authenticated, ADMIN+):
  - Find invitation by ID, verify it belongs to the active building
  - Only PENDING invitations can be revoked
  - Update `status: REVOKED`
  - Return 200

- [ ] `POST /api/invitations/[id]/resend` (authenticated, ADMIN+):
  - Find invitation by ID, verify it belongs to the active building
  - Only PENDING invitations can be resent
  - Generate new token, update `tokenHash` and `expiresAt`
  - Old link becomes invalid
  - TODO: Queue new email
  - Return 200

**Commit:** `feat(api): add invitation CRUD, accept, validate, revoke, resend endpoints`

---

## Task 6: Accept Invitation Page

**Files:**
- Create: `src/app/[locale]/accept-invitation/[token]/page.tsx`
- Create: `src/components/auth/accept-invitation-form.tsx`
- Modify: `src/middleware.ts` — add `/accept-invitation` to public routes
- Modify: `src/i18n/en.json` — add `invitation.*` keys
- Modify: `src/i18n/hu.json` — add `invitation.*` keys

**Steps:**

- [ ] Update middleware `publicPages` array to include `/accept-invitation`
- [ ] Update middleware logic: `/accept-invitation/*` should be viewable by anyone (including authenticated users) — add it to a new `publicAccessiblePages` array that does NOT redirect authenticated users to dashboard
- [ ] Create `src/app/[locale]/accept-invitation/[token]/page.tsx`:
  - Server component that extracts `token` from params
  - Calls `GET /api/invitations/[token]/validate` on mount (client-side)
  - Shows loading state, error state (expired/invalid), or the form
- [ ] Create `src/components/auth/accept-invitation-form.tsx`:
  - Client component with form fields:
    - Email (pre-filled from validation, read-only)
    - Role badge (pre-filled, read-only display)
    - Name (text input, required)
    - Password (password input, required, min 8 chars)
    - Confirm password (must match)
  - For `ADMIN_SETUP` type, additional fields:
    - Building name (text input, required)
    - Building address (text input, required)
    - Building city (text input, required)
    - Building zip code (text input, required)
  - Submit calls `POST /api/invitations/[token]/accept`
  - On success: redirect to `/login` with success message
  - On error: show inline error message
- [ ] Add expired invitation display with contextual message:
  - USER_INVITE: "This invitation has expired. Please contact your building administrator to request a new invitation."
  - ADMIN_SETUP: "This invitation has expired. Please contact support or start a new subscription."
- [ ] Add i18n keys for `invitation.acceptTitle`, `invitation.expired`, `invitation.expiredUserMessage`, `invitation.expiredAdminMessage`, `invitation.nameLabel`, `invitation.passwordLabel`, `invitation.confirmPasswordLabel`, `invitation.buildingNameLabel`, `invitation.buildingAddressLabel`, `invitation.buildingCityLabel`, `invitation.buildingZipCodeLabel`, `invitation.submitButton`, `invitation.successMessage`
- [ ] Add Hungarian translations for all invitation keys

**Commit:** `feat(ui): add accept invitation page with form and expired state handling`

---

## Task 7: Invitation Management UI

**Files:**
- Create: `src/app/[locale]/settings/invitations/page.tsx`
- Create: `src/components/settings/invitation-list.tsx`
- Create: `src/components/settings/invite-user-modal.tsx`
- Modify: `src/components/layout/sidebar.tsx` — add settings sub-items
- Modify: `src/i18n/en.json` — add `invitationManagement.*` keys
- Modify: `src/i18n/hu.json` — add `invitationManagement.*` keys

**Steps:**

- [ ] Create `src/app/[locale]/settings/invitations/page.tsx`:
  - Authenticated page, requires ADMIN+ role
  - Header with "Invitations" title and "Invite User" button
  - Renders `InvitationList` component

- [ ] Create `src/components/settings/invitation-list.tsx`:
  - Client component that fetches `GET /api/invitations`
  - Table columns: Email, Role, Status (badge), Sent By, Sent At, Expires At, Actions
  - Status badges: PENDING (yellow), ACCEPTED (green), EXPIRED (gray), REVOKED (red)
  - Actions per row:
    - PENDING: "Resend" button (calls `POST /api/invitations/[id]/resend`), "Revoke" button (calls `PATCH /api/invitations/[id]/revoke`)
    - ACCEPTED/EXPIRED/REVOKED: no actions
  - Status filter dropdown (All, Pending, Accepted, Expired, Revoked)

- [ ] Create `src/components/settings/invite-user-modal.tsx`:
  - Modal dialog triggered by "Invite User" button
  - Form fields: Email (required), Role (select: ADMIN, BOARD_MEMBER, RESIDENT, TENANT), Unit (optional select, populated from building units), Relationship (optional select: OWNER, TENANT — shown when unit is selected)
  - Submit calls `POST /api/invitations`
  - On success: close modal, refresh invitation list, show success toast
  - On 409: show "User is already a member" or "Pending invitation exists" error

- [ ] Update sidebar to show settings sub-items for invitations (ADMIN+):
  - Add to navItems settings entry: `subItems: [{ key: "settingsInvitations", href: "/settings/invitations", minimumRole: "ADMIN" }]`

- [ ] Add i18n keys for `invitationManagement.title`, `invitationManagement.inviteUser`, `invitationManagement.email`, `invitationManagement.role`, `invitationManagement.status`, `invitationManagement.sentBy`, `invitationManagement.sentAt`, `invitationManagement.expiresAt`, `invitationManagement.actions`, `invitationManagement.resend`, `invitationManagement.revoke`, `invitationManagement.revokeConfirm`, `invitationManagement.resendSuccess`, `invitationManagement.revokeSuccess`, `invitationManagement.alreadyMember`, `invitationManagement.pendingExists`, `invitationManagement.inviteSent`
- [ ] Add Hungarian translations

**Commit:** `feat(ui): add invitation management page with list, resend, revoke, and invite modal`

---

## Task 8: Gated Sidebar + Upgrade Modal

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Create: `src/components/shared/upgrade-modal.tsx`
- Create: `src/hooks/use-plan-features.ts`
- Create: `src/app/api/subscription/route.ts`
- Create: `src/app/api/subscription/usage/route.ts`
- Modify: `src/i18n/en.json` — add `featureGate.*` keys
- Modify: `src/i18n/hu.json` — add `featureGate.*` keys

**Steps:**

- [ ] Create `src/app/api/subscription/route.ts`:
  - `GET` — authenticated, returns current building's subscription with plan details
  - Includes: plan name, slug, features array, limits, subscription status, trial end date

- [ ] Create `src/app/api/subscription/usage/route.ts`:
  - `GET` — authenticated, returns building count vs max, unit count vs max for current building
  - Response: `{ buildings: { current, max }, units: { current, max } }`

- [ ] Create `src/hooks/use-plan-features.ts`:
  - Fetches `GET /api/subscription` on mount
  - Exposes: `features: string[]`, `planSlug: string`, `isTrialing: boolean`, `hasFeature(slug): boolean`, `loading: boolean`
  - Caches in React state, refreshes on building switch

- [ ] Extend `NavItem` interface in sidebar:
  - Add optional `featureSlug?: string` field — maps to the feature flag that gates this nav item
  - Add optional `requiredPlan?: string` field — the minimum plan badge to show ("PRO", "ENT")

- [ ] Add feature metadata to `navItems` array:
  ```typescript
  { key: "forum", href: "/forum", icon: MessageSquare, minimumRole: "TENANT", featureSlug: "forum", requiredPlan: "PRO" },
  { key: "finance", href: "/finance", icon: Wallet, minimumRole: "TENANT", featureSlug: "finance", requiredPlan: "PRO" },
  { key: "maintenance", href: "/maintenance", icon: Wrench, minimumRole: "TENANT", featureSlug: "maintenance", requiredPlan: "PRO" },
  { key: "voting", href: "/voting", icon: Vote, minimumRole: "TENANT", featureSlug: "voting", requiredPlan: "PRO" },
  // complaints, announcements, messages, documents — no featureSlug (Starter features, always available)
  ```

- [ ] Update sidebar rendering logic:
  - Use `use-plan-features` hook
  - For items with `featureSlug`: check `hasFeature(item.featureSlug)`
  - If feature not available: render as disabled (muted text `text-slate-500`, `cursor-not-allowed`, no `<Link>` wrapper)
  - Show plan badge next to label: `<span className="ml-auto text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">PRO</span>`
  - On click of disabled item: open upgrade modal instead of navigating

- [ ] Create `src/components/shared/upgrade-modal.tsx`:
  - Props: `isOpen`, `onClose`, `featureName`, `requiredPlan`, `currentPlan`
  - Content: feature description, "Available on the {requiredPlan} plan", "Upgrade" CTA button (links to `/settings/billing`), "Dismiss" button
  - Uses dialog/modal pattern consistent with existing modals in the project

- [ ] Add i18n keys: `featureGate.upgradeTitle`, `featureGate.upgradeDescription`, `featureGate.availableOn`, `featureGate.upgradeButton`, `featureGate.dismiss`, `featureGate.currentPlan`, plan display names (`featureGate.planStarter`, `featureGate.planPro`, `featureGate.planEnterprise`)
- [ ] Add Hungarian translations

**Commit:** `feat(ui): add gated sidebar with plan badges and upgrade modal`

---

## Task 9: Integrate Feature Gating in API Routes

**Files:**
- Modify: `src/app/api/forum/categories/route.ts`
- Modify: `src/app/api/forum/topics/route.ts`
- Modify: `src/app/api/finance/charges/route.ts`
- Modify: `src/app/api/finance/summary/route.ts`
- Modify: `src/app/api/finance/ledger/route.ts`
- Modify: `src/app/api/finance/budget/route.ts`
- Modify: `src/app/api/finance/accounts/route.ts`
- Modify: `src/app/api/maintenance/tickets/route.ts`
- Modify: `src/app/api/maintenance/scheduled/route.ts`
- Modify: `src/app/api/voting/meetings/route.ts`
- Modify: `src/app/api/voting/votes/route.ts`
- Modify: `src/app/api/buildings/route.ts` (POST — check building limit)
- Modify: `src/app/api/units/route.ts` (POST — check unit limit, if exists)

**Steps:**

- [ ] Add `requireFeature()` call at the top of each gated route handler (after auth check, before business logic):
  - Forum routes: `requireFeature(buildingId, "forum")` — return 403 JSON `{ error: "Feature not available", requiredPlan: "pro", feature: "forum" }` if not allowed
  - Finance routes: `requireFeature(buildingId, "finance")`
  - Maintenance routes: `requireFeature(buildingId, "maintenance")`
  - Voting routes: `requireFeature(buildingId, "voting")`

- [ ] Add plan limit checks:
  - `POST /api/buildings`: call `checkBuildingLimit(subscriptionId)` before creating. Return 403 with `{ error: "Building limit reached", current, max }` if at limit.
  - Unit creation endpoints: call `checkUnitLimit(buildingId)` before creating. Return 403 with `{ error: "Unit limit reached", current, max }` if at limit.

- [ ] Non-gated routes (complaints, announcements, messaging, documents) — no changes needed, these are Starter features always available

- [ ] Create `POST /api/admin/subscriptions/[id]/plan/route.ts`:
  - Requires SUPER_ADMIN role
  - Body: `{ planId: string }`
  - Updates subscription's planId
  - Returns updated subscription

**Commit:** `feat(api): integrate feature gating and plan limits in route handlers`

---

## Task 10: Tests

**Files:**
- Create: `src/lib/__tests__/feature-gate.test.ts`
- Create: `src/lib/__tests__/plan-limits.test.ts`
- Create: `src/lib/__tests__/invitation.test.ts`

**Steps:**

- [ ] Test `requireFeature()`:
  - Returns allowed for features in the plan
  - Returns not allowed for features NOT in the plan
  - Trial period: all features allowed when trialing and not expired
  - Trial expired: falls back to plan features
  - Missing subscription: allowed (legacy support)

- [ ] Test `checkBuildingLimit()`:
  - Returns allowed when under limit
  - Returns not allowed when at limit
  - Unlimited (-1) always returns allowed

- [ ] Test `checkUnitLimit()`:
  - Returns allowed when under limit
  - Returns not allowed when at limit
  - Unlimited (-1) always returns allowed

- [ ] Test `generateInvitationToken()`:
  - Returns 64-character hex string
  - Each call returns a unique token

- [ ] Test `hashToken()`:
  - Returns consistent hash for same input
  - Returns different hash for different input

- [ ] Test `findInvitationByToken()`:
  - Returns invitation when token matches hash in DB
  - Returns null when token does not match

- [ ] Test `isInvitationExpired()`:
  - Returns true when `expiresAt` is in the past
  - Returns true when status is not PENDING
  - Returns false when valid and PENDING

**Commit:** `test: add unit tests for feature gating, plan limits, and invitation tokens`
