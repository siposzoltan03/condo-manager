# Subscription Plans & Invitation System — Design Spec

**Date:** 2026-03-30
**Branch:** `feat/multi-building`
**Status:** Draft

---

## Overview

The platform currently has no self-registration, no invitation system, and no subscription model. Users can only be created by admins who set temporary passwords. This spec introduces:

1. **Subscription plans** with tiered limits (buildings, units, features)
2. **Stripe integration** for self-service checkout + manual admin override
3. **Invitation system** — post-purchase admin setup + in-app user invitations
4. **Marketing/pricing landing page** as the new public entry point
5. **Feature gating** with disabled menu items and plan badges

---

## Architecture: Hybrid Account Layer

A lightweight `Subscription` entity owns the Stripe subscription and buildings. Single-building buyers get an auto-created subscription (invisible in UI). Management companies get a shared subscription with consolidated billing. This supports both buyer types without over-engineering.

> **Note:** The entity is named `Subscription` (not `Account`) to avoid collision with the existing `Account` model in the finance module (double-entry bookkeeping ledger accounts).

---

## Data Model

### New Models

#### Subscription

| Field                  | Type                 | Notes                                    |
|------------------------|----------------------|------------------------------------------|
| id                     | String (cuid)        | Primary key                              |
| name                   | String               | Company/account name                     |
| email                  | String               | Billing contact email                    |
| stripeCustomerId       | String?              | Stripe customer reference                |
| stripeSubscriptionId   | String?              | Stripe subscription reference            |
| planId                 | String → Plan        | Active plan                              |
| trialEndsAt            | DateTime?            | Trial expiry timestamp                   |
| subscriptionStatus     | SubscriptionStatus   | TRIALING, ACTIVE, PAST_DUE, CANCELED, EXPIRED |
| ownerId                | String → User        | Billing admin (one owner per subscription) |
| createdAt              | DateTime             |                                          |
| updatedAt              | DateTime             |                                          |
| buildings              | Building[]           | Buildings owned by this subscription     |

#### Plan

| Field                | Type            | Notes                                      |
|----------------------|-----------------|--------------------------------------------|
| id                   | String (cuid)   | Primary key                                |
| name                 | String          | Display name (e.g., "Professional")        |
| slug                 | String (unique) | URL-safe identifier (e.g., "pro")          |
| stripePriceId        | String?         | Stripe price reference                     |
| maxBuildings         | Int             | Building limit (-1 = unlimited)            |
| maxUnitsPerBuilding  | Int             | Unit limit per building (-1 = unlimited)   |
| features             | Json            | Array of feature flag strings              |
| priceMonthly         | Decimal         | Monthly price                              |
| priceYearly          | Decimal         | Yearly price                               |
| trialDays            | Int             | Default: 14                                |
| isActive             | Boolean         | Soft-delete for retired plans              |
| createdAt            | DateTime        |                                            |

#### Invitation

| Field        | Type                  | Notes                                           |
|--------------|-----------------------|-------------------------------------------------|
| id           | String (cuid)         | Primary key                                     |
| email        | String                | Invitee email                                   |
| tokenHash    | String                | SHA-256 hash of the raw token                   |
| type         | InvitationType        | ADMIN_SETUP or USER_INVITE                      |
| role         | BuildingRole?         | Pre-assigned role (required for USER_INVITE)    |
| unitId       | String?               | Pre-assigned unit (optional)                    |
| relationship | UnitRelationship?     | OWNER or TENANT (optional)                      |
| buildingId   | String? → Building    | Nullable for ADMIN_SETUP (building created on accept) |
| subscriptionId | String? → Subscription | For ADMIN_SETUP invitations                   |
| invitedById  | String? → User        | Null for post-purchase system invitations       |
| expiresAt    | DateTime              | Configurable per building                       |
| acceptedAt   | DateTime?             | When the invitation was accepted                |
| status       | InvitationStatus      | PENDING, ACCEPTED, EXPIRED, REVOKED             |
| createdAt    | DateTime              |                                                 |
| updatedAt    | DateTime              |                                                 |

### Modified Models

- **Building** — add `subscriptionId → Subscription` (optional during migration, required for new buildings)
- **Building** — add `invitationExpiryHours: Int` (default: 168 = 7 days)

### Enums

```prisma
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  EXPIRED
}

enum InvitationType {
  ADMIN_SETUP
  USER_INVITE
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}
```

### Relationships

- `Subscription` → one `User` (owner). One user can own multiple subscriptions (e.g., a manager running separate billing for different clients).
- `Subscription` → many `Building`s.
- `Invitation` → optional `Building` (null for ADMIN_SETUP, required for USER_INVITE).

---

## Plan Tiers

### Starter

- **Limits:** 1 building, up to 30 units
- **Features:** complaints, announcements, messaging, documents
- **Target:** Individual building managers

### Professional

- **Limits:** Up to 5 buildings, up to 100 units per building
- **Features:** Everything in Starter + finance, voting, maintenance, forum
- **Target:** Growing buildings and HOAs

### Enterprise

- **Limits:** Unlimited buildings, unlimited units
- **Features:** Everything in Professional + API access, custom branding, audit log exports, priority support
- **Target:** Property management companies

### Trial Period

- New accounts get 14 days with all Enterprise features unlocked
- After trial expiry, falls back to selected plan's limits
- If no plan selected at trial end, access is suspended until a plan is chosen

### Plan Seeding

Plans are seeded via a database seed script (extending the existing `prisma/seed.ts`). The `stripePriceId` values must match the corresponding Stripe Dashboard configuration. The seed script will create all three plans with `isActive: true`. There is no admin UI for plan management — plan changes are done via seed script + Stripe Dashboard.

---

## Feature Gating

### Mechanism

The `Plan.features` field stores a JSON array of feature flag strings:

```json
["complaints", "announcements", "messaging", "documents", "finance", "voting", "maintenance", "forum", "api_access", "custom_branding", "audit_exports"]
```

### Enforcement

- **API level:** A `requireFeature(featureSlug)` helper is called within individual route handlers (not middleware). It loads the building's subscription plan and checks the features array. Returns 403 with an upgrade message if the feature is not included.
- **Sidebar:** All menu items are always visible. Gated items are rendered as disabled (muted text, no hover, no navigation) with a small plan badge ("PRO", "ENT") indicating the required tier.
- **Gated page click:** Clicking a disabled sidebar item opens a modal with the feature description, required plan, and an "Upgrade" CTA + "Dismiss" button.
- **Limit enforcement:** Actions like "Add Building" or "Add Unit" check against `maxBuildings` and `maxUnitsPerBuilding`. When at capacity, show upgrade prompt with current usage vs. limit.
- **Hard block:** All gating is hard — the action is denied. No soft warnings or grace periods (trial period handles the grace case).

### Trial Expiry During Active Session

The JWT session lasts up to 8 hours with a 1-hour sliding refresh. Trial expiry is checked server-side on every API call via `requireFeature()`, not just at JWT refresh time. This means:
- API calls are blocked immediately when the trial expires, even mid-session.
- The frontend checks trial status on each page navigation and shows the suspension screen when the API returns 403.

---

## User Flows

### Flow 1: Purchase & Admin Setup

1. Visitor lands on the marketing/pricing page (new root `/`)
2. Picks a plan → redirected to Stripe Checkout
3. On success, Stripe redirects to `/checkout/success?session_id=...`
4. The success page calls `POST /api/stripe/verify-session` with the `session_id` to synchronously create the `Subscription` + `Plan` association (does not rely on webhook timing). The webhook handler is idempotent and will skip creation if the subscription already exists.
5. System sends admin setup invitation email with a secure link
6. Buyer clicks link → `/accept-invitation/[token]` → sets name, password, creates first building
7. Subscription is live, buyer is the first ADMIN of their building

### Flow 2: Admin Invites Users

1. Admin goes to user management, clicks "Invite User"
2. Fills in: email (required), role (required), unit + relationship (optional)
3. System checks for existing `UserBuilding` membership — returns error if user is already a member of this building
4. System creates `Invitation` record, queues email with invite link
5. Invitee clicks link → `/accept-invitation/[token]` → sets name, password, completes any missing fields (unit selection, relationship)
6. User account is created and linked to the building

### Flow 3: Feature Gating (In-App)

1. User sees all sidebar items — gated ones shown as disabled with plan badge
2. Clicking a disabled item opens modal: feature description + "Upgrade" CTA + "Dismiss"
3. Limit enforcement: "Add Building" shows upgrade prompt when at building cap

### Flow 4: Trial Experience

1. New account gets 14-day trial with all features enabled
2. Trial countdown shown in settings/billing page
3. When trial expires → gated features become disabled with plan badges
4. If no plan selected → access suspended with "Choose a plan to continue"

### Flow 5: Expired Invitation

1. User clicks an expired invitation link
2. `/accept-invitation/[token]` validates the token — finds it expired
3. Shows a page: "This invitation has expired."
4. For USER_INVITE: "Please contact your building administrator to request a new invitation."
5. For ADMIN_SETUP: "Please contact support or start a new subscription."

### Flow 6: Plan Downgrade

1. User downgrades to a plan with lower limits via Stripe Customer Portal
2. Webhook receives `customer.subscription.updated`
3. If current usage exceeds new plan limits (e.g., 5 buildings → Starter's 1 building limit):
   - The downgrade is blocked at the Stripe Customer Portal level (Stripe metadata check)
   - If it somehow goes through, excess buildings are frozen (read-only) with a visual "Frozen" indicator
   - Admin sees a banner: "You have X buildings over your plan limit. Remove buildings or upgrade to restore full access."
4. Feature access is immediately restricted to the new plan's feature set

### Flow 7: Invitation Resend

1. Admin clicks "Resend" on a pending invitation
2. System generates a new token, updates `tokenHash` and `expiresAt` on the existing invitation record
3. The old invitation link becomes invalid
4. New email is sent with the fresh link

---

## Page Structure & Routing

### New Public Pages (Unauthenticated)

| Route                        | Purpose                                              |
|------------------------------|------------------------------------------------------|
| `/`                          | Marketing landing + pricing (new root, replaces redirect-to-login) |
| `/pricing`                   | Dedicated pricing comparison (or section of landing)  |
| `/checkout/[planSlug]`       | Redirects to Stripe Checkout session                  |
| `/checkout/success`          | Post-checkout confirmation + subscription setup       |
| `/accept-invitation/[token]` | Set password + complete profile                       |

### New Authenticated Pages

| Route                   | Purpose                                          |
|-------------------------|--------------------------------------------------|
| `/settings/billing`     | Manage subscription, view plan, upgrade/downgrade |
| `/settings/invitations` | Admin view of sent invitations, resend, revoke    |

### Existing Pages (Unchanged)

- `/login` — Stays as-is, now a sub-page (not the entry point)
- `/forgot-password`, `/reset-password` — Stay as-is

### Middleware Changes

- **Public-accessible pages** (viewable by anyone, including authenticated users): `/`, `/pricing`, `/checkout/*`, `/accept-invitation/*`
- **Auth-excluded pages** (redirect authenticated users to dashboard): `/login`, `/forgot-password`, `/reset-password` — current behavior preserved
- Feature gating is enforced per-handler via `requireFeature()`, not via middleware

This distinction allows authenticated users to view the pricing page (e.g., to compare plans for an upgrade) without being redirected to the dashboard.

### Design Note

New page designs (landing, pricing, checkout, accept-invitation) should be created via **Stitch** before implementation.

---

## Stripe Integration

### Checkout Flow

1. Frontend calls `POST /api/stripe/checkout` with `planSlug` and `billingPeriod`
2. Backend creates a Stripe Checkout Session with the plan's `stripePriceId`
3. Frontend redirects to Stripe-hosted checkout page
4. On success, Stripe redirects to `/checkout/success?session_id=...`
5. Success page calls `POST /api/stripe/verify-session` to synchronously create the subscription (avoids webhook delay)

### Webhook Handling

`POST /api/stripe/webhook` handles (all handlers are idempotent):

| Event                              | Action                                              |
|------------------------------------|-----------------------------------------------------|
| `checkout.session.completed`       | Create Subscription + Plan if not exists, send admin setup invite |
| `invoice.paid`                     | Update subscriptionStatus to ACTIVE                  |
| `invoice.payment_failed`           | Update subscriptionStatus to PAST_DUE                |
| `customer.subscription.updated`    | Sync plan changes (upgrade/downgrade)                |
| `customer.subscription.deleted`    | Update subscriptionStatus to CANCELED                |

### Customer Portal

- `/settings/billing` links to Stripe Customer Portal for self-service plan changes, payment method updates, and invoice history

### Manual Override

- Platform SUPER_ADMIN can assign/change plans via an internal API (`POST /api/admin/subscriptions/[id]/plan`), bypassing Stripe
- Used for sales-led deals, custom arrangements, or troubleshooting

---

## Invitation Token Security

Follows an improved version of the existing `PasswordResetToken` pattern:

1. Generate a cryptographically random token (32 bytes, hex-encoded)
2. Store only the SHA-256 hash in the database
3. Send the raw token in the invitation URL
4. On acceptance, hash the provided token and compare against stored hash
5. Mark as ACCEPTED on use; check expiry before accepting
6. Configurable expiry per building (default: 7 days)
7. **Rate limiting:** The public acceptance endpoint (`POST /api/invitations/[token]/accept`) is rate-limited to 5 attempts per IP per 15 minutes to prevent brute-force attacks
8. **Resend invalidates old token:** Resending an invitation generates a new token and updates the hash — the previous link becomes invalid

> **Tech debt note:** The existing `PasswordResetToken` model stores tokens in plaintext. Consider migrating to hashed tokens for consistency with the new invitation system.

---

## API Endpoints

### Stripe

- `POST /api/stripe/checkout` — Create checkout session
- `POST /api/stripe/webhook` — Handle Stripe events (idempotent)
- `POST /api/stripe/verify-session` — Synchronously verify and provision after checkout
- `POST /api/stripe/portal` — Create customer portal session

### Invitations

- `POST /api/invitations` — Send invitation (admin, requires ADMIN role; checks for existing membership)
- `GET /api/invitations` — List invitations for current building (admin)
- `POST /api/invitations/[token]/accept` — Accept invitation (public, rate-limited)
- `GET /api/invitations/[token]/validate` — Validate token and return pre-filled data (public)
- `PATCH /api/invitations/[id]/revoke` — Revoke invitation (admin)
- `POST /api/invitations/[id]/resend` — Resend with new token (admin)

### Subscription / Billing

- `GET /api/subscription` — Get current subscription + plan details
- `GET /api/subscription/usage` — Get current usage vs. plan limits
- `POST /api/admin/subscriptions/[id]/plan` — Manual plan assignment (SUPER_ADMIN)

### Plans

- `GET /api/plans` — List active plans (public, for pricing page)

---

## Migration Strategy

### Existing Data

The database already contains buildings and users with no subscription concept. The migration must handle this:

1. Create a "Legacy" plan with Enterprise-level limits and all features enabled
2. Create a default `Subscription` record (name: "Legacy", status: ACTIVE, plan: Legacy)
3. Assign all existing buildings to the legacy subscription
4. `Building.subscriptionId` is optional in the schema initially — the migration populates it for all existing buildings, then a follow-up migration makes it required
5. Assign the existing SUPER_ADMIN user as the legacy subscription owner

This ensures existing installations continue working without disruption.

---

## Summary

| Component             | Approach                                              |
|-----------------------|-------------------------------------------------------|
| Subscription model    | Hybrid — `Subscription` entity owns buildings + Stripe subscription |
| Payment               | Stripe Checkout + webhooks + manual SUPER_ADMIN override |
| Plan tiers            | Starter / Professional / Enterprise (buildings + units + features) |
| Feature gating        | Hard block, disabled sidebar items with plan badges    |
| Trial                 | 14 days, full Enterprise features                      |
| Admin onboarding      | Post-purchase invitation email → set password flow     |
| User invitations      | Admin sends invite with flexible pre-fill, invitee completes |
| Invitation expiry     | Configurable per building, default 7 days              |
| Token security        | SHA-256 hashed, rate-limited acceptance endpoint       |
| New pages             | Landing, pricing, checkout, accept-invitation, billing settings, invitation management |
| Migration             | Legacy plan + default subscription for existing data   |
