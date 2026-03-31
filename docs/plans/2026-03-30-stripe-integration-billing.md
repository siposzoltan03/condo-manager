# Stripe Integration & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Stripe Checkout, webhook handling, customer portal, and a billing settings page for subscription management.

**Architecture:** Frontend redirects to Stripe-hosted Checkout for payment. A verify-session endpoint synchronously provisions the subscription on redirect (avoiding webhook delay). Webhooks handle ongoing lifecycle events idempotently. The billing page shows current plan, usage, and links to Stripe Customer Portal for self-service changes.

**Tech Stack:** Stripe SDK (`stripe`), Next.js 15 API routes, Prisma, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-30-subscription-plans-and-invitations-design.md`

**Depends on:** Plan A (schema, Plan/Subscription models must exist)

---

## File Structure — What Changes

```
src/
├── lib/
│   └── stripe.ts                                    # NEW: Stripe client singleton + helpers
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── checkout/route.ts                    # NEW: POST create checkout session
│   │       ├── verify-session/route.ts              # NEW: POST verify + provision after checkout
│   │       ├── webhook/route.ts                     # NEW: POST handle Stripe events
│   │       └── portal/route.ts                      # NEW: POST create customer portal session
│   └── [locale]/
│       └── settings/
│           └── billing/
│               └── page.tsx                         # NEW: billing settings page
├── components/
│   └── settings/
│       ├── billing-overview.tsx                     # NEW: current plan card + usage
│       ├── billing-actions.tsx                      # NEW: manage/upgrade/cancel buttons
│       └── trial-countdown.tsx                      # NEW: trial expiry banner
├── i18n/
│   ├── en.json                                      # Add billing.* keys
│   └── hu.json                                      # Add billing.* keys
.env.local                                            # Add STRIPE_* env vars (not committed)
```

---

## Task 1: Install Stripe + Configuration

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.example` or `.env.local` (document required vars)
- Create: `src/lib/stripe.ts`

**Steps:**

- [ ] Install Stripe SDK: `npm install stripe`
- [ ] Add environment variables to `.env.example` (or document in a comment):
  ```
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```
- [ ] Create `src/lib/stripe.ts`:
  ```typescript
  import Stripe from "stripe";

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
  });
  ```
- [ ] Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to `src/lib/env.ts` validation (if the project uses env validation)
- [ ] Verify TypeScript compilation passes with the new dependency

**Commit:** `feat(stripe): install Stripe SDK and add client singleton`

---

## Task 2: Checkout API

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/verify-session/route.ts`

**Steps:**

- [ ] `POST /api/stripe/checkout` (public — no auth required, buyer is not yet a user):
  - Validate body: `planSlug` (required string), `billingPeriod` ("monthly" | "yearly"), `email` (required string)
  - Look up Plan by slug — return 404 if not found or not active
  - Determine `stripePriceId` from the plan (monthly vs yearly price IDs stored in plan or derived from slug convention)
  - Create Stripe Checkout Session:
    ```typescript
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/{locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/{locale}/pricing`,
      metadata: {
        planSlug: plan.slug,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          planSlug: plan.slug,
          planId: plan.id,
        },
        trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
      },
    });
    ```
  - Return 200 with `{ sessionId: session.id, url: session.url }`

- [ ] `POST /api/stripe/verify-session` (public — called from checkout success page):
  - Validate body: `sessionId` (required string)
  - Retrieve the Checkout Session from Stripe: `stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] })`
  - Verify session status is "complete"
  - Check if subscription already exists for this `stripeSubscriptionId` — if yes, return existing (idempotent)
  - In a transaction:
    - Create `Subscription` record:
      - `name`: from session customer email (temporary, updated on admin setup)
      - `email`: session customer email
      - `stripeCustomerId`: session.customer
      - `stripeSubscriptionId`: session.subscription.id
      - `planId`: from session metadata
      - `subscriptionStatus`: session.subscription.status === "trialing" ? "TRIALING" : "ACTIVE"
      - `trialEndsAt`: from session.subscription.trial_end (convert to Date)
      - `ownerId`: null initially (set when admin accepts invitation)
    - Note: `ownerId` is required in schema — use a system/placeholder user or make `ownerId` nullable for this flow. Alternative: create a pending user record with just the email.
  - Generate admin setup invitation (from Plan A's invitation helpers):
    - Create Invitation with type `ADMIN_SETUP`, email from session, subscriptionId
    - TODO: Queue email with invitation link
  - Return 200 with `{ subscription, invitationSent: true }`

**Commit:** `feat(api): add Stripe checkout session creation and post-checkout verification`

---

## Task 3: Webhook Handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Steps:**

- [ ] `POST /api/stripe/webhook` (public, no auth — Stripe calls this):
  - Read raw body using `request.text()` (NOT `request.json()` — Stripe signature verification needs raw body)
  - Verify webhook signature:
    ```typescript
    const signature = request.headers.get("stripe-signature")!;
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    ```
  - Return 400 if signature verification fails

- [ ] Handle `checkout.session.completed`:
  - Extract `stripeSubscriptionId` from event data
  - Check if Subscription already exists (idempotent with verify-session)
  - If not exists: create Subscription + send admin setup invitation (same logic as verify-session)
  - If exists: no-op, return 200

- [ ] Handle `invoice.paid`:
  - Find Subscription by `stripeSubscriptionId`
  - Update `subscriptionStatus` to `ACTIVE`
  - If not found, log warning and return 200 (don't fail the webhook)

- [ ] Handle `invoice.payment_failed`:
  - Find Subscription by `stripeSubscriptionId`
  - Update `subscriptionStatus` to `PAST_DUE`

- [ ] Handle `customer.subscription.updated`:
  - Find Subscription by `stripeSubscriptionId`
  - Sync plan: look up Plan by the new Stripe price ID → update `planId`
  - Update `subscriptionStatus` based on Stripe subscription status
  - If downgrade detected (new plan has lower limits):
    - Check if current usage exceeds new limits
    - If over limit: freeze excess buildings (set a `frozen` flag or use subscription status)
    - Log the downgrade event

- [ ] Handle `customer.subscription.deleted`:
  - Find Subscription by `stripeSubscriptionId`
  - Update `subscriptionStatus` to `CANCELED`

- [ ] Return 200 for all handled events, 200 for unhandled events (Stripe retries on non-2xx)
- [ ] Add structured logging for all webhook events (event type, subscription ID, outcome)

- [ ] Add the webhook route to middleware's public API exception list (no auth required):
  - Update middleware: skip auth check for `/api/stripe/webhook`

**Commit:** `feat(api): add Stripe webhook handler for subscription lifecycle events`

---

## Task 4: Customer Portal

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

**Steps:**

- [ ] `POST /api/stripe/portal` (authenticated):
  - Get current user's subscription (via active building → subscription)
  - Verify `stripeCustomerId` exists on the subscription — return 400 if not (legacy/manual subscriptions)
  - Create Stripe Customer Portal session:
    ```typescript
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/{locale}/settings/billing`,
    });
    ```
  - Return 200 with `{ url: session.url }`

**Commit:** `feat(api): add Stripe customer portal session endpoint`

---

## Task 5: Billing Settings Page

**Files:**
- Create: `src/app/[locale]/settings/billing/page.tsx`
- Create: `src/components/settings/billing-overview.tsx`
- Create: `src/components/settings/billing-actions.tsx`
- Create: `src/components/settings/trial-countdown.tsx`
- Modify: `src/components/layout/sidebar.tsx` — add billing sub-item under settings
- Modify: `src/i18n/en.json` — add `billing.*` keys
- Modify: `src/i18n/hu.json` — add `billing.*` keys

**Steps:**

- [ ] Create `src/app/[locale]/settings/billing/page.tsx`:
  - Authenticated page, requires ADMIN+ role
  - Fetches `GET /api/subscription` and `GET /api/subscription/usage`
  - Renders billing overview, trial countdown (if applicable), and action buttons
  - Layout: single column, card-based

- [ ] Create `src/components/settings/billing-overview.tsx`:
  - Current plan card: plan name, plan badge, price, billing period
  - Usage section: "Buildings: 2 / 5", "Units: 45 / 100" with progress bars
  - Subscription status badge: ACTIVE (green), TRIALING (blue), PAST_DUE (red), CANCELED (gray)
  - For legacy subscriptions: show "Legacy Plan" with no usage limits

- [ ] Create `src/components/settings/trial-countdown.tsx`:
  - Shown only when `subscriptionStatus === "TRIALING"` and `trialEndsAt` is set
  - Displays: "Trial ends in X days" with a countdown
  - When < 3 days: yellow warning style
  - When expired: red "Trial expired — choose a plan to continue"
  - CTA: "Choose a Plan" button linking to `/pricing`

- [ ] Create `src/components/settings/billing-actions.tsx`:
  - "Manage Subscription" button — calls `POST /api/stripe/portal`, redirects to returned URL
  - Disabled with tooltip "No Stripe subscription" for legacy/manual subscriptions
  - "View Pricing" link to `/pricing`
  - For SUPER_ADMIN: show subscription ID for debugging

- [ ] Update sidebar settings sub-items:
  - Add `{ key: "settingsBilling", href: "/settings/billing", minimumRole: "ADMIN" }`

- [ ] Add i18n keys:
  - `billing.title`, `billing.currentPlan`, `billing.usage`, `billing.buildings`, `billing.units`, `billing.unlimited`, `billing.status`, `billing.manageSubscription`, `billing.viewPricing`, `billing.trialEndsIn`, `billing.trialExpired`, `billing.choosePlan`, `billing.daysRemaining`, `billing.legacyPlan`, `billing.noStripeSubscription`
- [ ] Add Hungarian translations

**Commit:** `feat(ui): add billing settings page with plan overview, usage, and Stripe portal`

---

## Task 6: Subscription API Endpoints

**Files:**
- Create: `src/app/api/subscription/route.ts` (if not created in Plan A Task 8)
- Create: `src/app/api/subscription/usage/route.ts` (if not created in Plan A Task 8)
- Create: `src/app/api/admin/subscriptions/[id]/plan/route.ts`

**Steps:**

- [ ] `GET /api/subscription` (authenticated):
  - Get active building's subscription with plan included
  - Return: `{ id, name, email, planId, plan: { name, slug, features, maxBuildings, maxUnitsPerBuilding, priceMonthly, priceYearly }, subscriptionStatus, trialEndsAt, stripeCustomerId (boolean hasStripe, not the actual ID) }`
  - If no subscription (legacy building without one): return a synthetic response with legacy plan data

- [ ] `GET /api/subscription/usage` (authenticated):
  - Count buildings under the subscription: `prisma.building.count({ where: { subscriptionId } })`
  - Count units in the active building: `prisma.unit.count({ where: { buildingId } })`
  - Return: `{ buildings: { current, max }, units: { current, max } }`
  - max = -1 means unlimited

- [ ] `POST /api/admin/subscriptions/[id]/plan` (authenticated, SUPER_ADMIN only):
  - Validate body: `planId` (required string)
  - Verify plan exists and is active
  - Update subscription's `planId`
  - Optionally update `subscriptionStatus` to ACTIVE if currently EXPIRED (manual override)
  - Log the change in AuditLog
  - Return 200 with updated subscription

**Commit:** `feat(api): add subscription and usage endpoints with SUPER_ADMIN plan override`

---

## Task 7: Plan Downgrade Handling

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts` (enhance `customer.subscription.updated` handler)
- Modify: `src/components/settings/billing-overview.tsx` — add over-limit banner
- Modify: `prisma/schema.prisma` — add `isFrozen` field to Building (if needed)

**Steps:**

- [ ] In webhook `customer.subscription.updated` handler:
  - After syncing the new plan, check if current building count exceeds `maxBuildings`
  - If over limit:
    - Mark excess buildings as frozen (newest buildings first): add `isFrozen: Boolean @default(false)` to Building model if not already present
    - Run migration: `npx prisma migrate dev --name add-building-frozen-flag`
    - Frozen buildings become read-only (API routes check `building.isFrozen` and reject write operations with 403)

- [ ] Add frozen building check in key API routes:
  - At the start of POST/PATCH/DELETE handlers for building-scoped routes, check `building.isFrozen`
  - If frozen: return 403 `{ error: "This building is frozen due to plan limits. Upgrade your plan or remove excess buildings." }`
  - GET requests still work (read-only access)

- [ ] Update `src/components/settings/billing-overview.tsx`:
  - Show warning banner when buildings are over limit:
    - "You have X buildings over your plan limit. Remove buildings or upgrade to restore full access."
    - List frozen buildings with a "Frozen" badge
  - Show banner when trial has expired and no plan selected

- [ ] Add i18n keys: `billing.frozenBanner`, `billing.frozenBuildingBadge`, `billing.overLimit`, `billing.removeOrUpgrade`
- [ ] Add Hungarian translations

**Commit:** `feat: add plan downgrade handling with building freeze and over-limit banner`
