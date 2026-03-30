# Public Pages — Landing, Pricing & Checkout Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a marketing landing page, pricing comparison page, and checkout flow pages as the public-facing entry point to the platform.

**Architecture:** The root route (`/`) becomes a marketing landing page instead of redirecting to login. Public pages are accessible to all visitors (including authenticated users) via updated middleware. Pricing data is fetched from a public API that reads plan records from the database. The checkout page redirects to Stripe Checkout via the checkout API from Plan B.

**Tech Stack:** Next.js 15, next-intl, Tailwind CSS, Stripe (redirect only)

**Spec:** `docs/superpowers/specs/2026-03-30-subscription-plans-and-invitations-design.md`

**Depends on:** Plan A (Plan model must exist), Plan B (Stripe checkout API must exist)

---

## File Structure — What Changes

```
src/
├── middleware.ts                                     # MODIFY: add public-accessible routes
├── app/
│   ├── api/
│   │   └── plans/
│   │       └── route.ts                             # NEW: GET public plans list
│   └── [locale]/
│       ├── page.tsx                                 # MODIFY: replace dashboard redirect with landing page
│       ├── pricing/
│       │   └── page.tsx                             # NEW: pricing comparison page
│       ├── checkout/
│       │   ├── [planSlug]/
│       │   │   └── page.tsx                         # NEW: redirect to Stripe Checkout
│       │   └── success/
│       │       └── page.tsx                         # NEW: post-checkout confirmation
│       └── layout.tsx                               # MODIFY: conditional layout (public vs authenticated)
├── components/
│   ├── landing/
│   │   ├── hero-section.tsx                         # NEW: hero with CTA
│   │   ├── feature-grid.tsx                         # NEW: feature showcase
│   │   ├── social-proof.tsx                         # NEW: testimonials/stats placeholder
│   │   └── landing-nav.tsx                          # NEW: public navigation bar
│   ├── pricing/
│   │   ├── plan-card.tsx                            # NEW: individual plan card
│   │   ├── plan-comparison.tsx                      # NEW: feature comparison table
│   │   └── billing-toggle.tsx                       # NEW: monthly/yearly toggle
│   └── checkout/
│       └── checkout-success.tsx                     # NEW: success confirmation component
├── i18n/
│   ├── en.json                                      # Add landing.*, pricing.*, checkout.* keys
│   └── hu.json                                      # Add landing.*, pricing.*, checkout.* keys
```

---

## Task 1: Middleware Updates for Public Routes

**Files:**
- Modify: `src/middleware.ts`

**Steps:**

- [ ] Add a new `publicAccessiblePages` array for routes that should be viewable by anyone INCLUDING authenticated users (no redirect to dashboard):
  ```typescript
  const publicAccessiblePages = ["/", "/pricing", "/checkout", "/accept-invitation"];
  ```

- [ ] Add a helper `isPublicAccessiblePage(pathname: string)` that checks if the path (after stripping locale) matches any entry in `publicAccessiblePages` or starts with any entry followed by `/`

- [ ] Update the auth middleware logic:
  - Keep existing `publicPages` array (`/login`, `/forgot-password`, `/reset-password`) — these redirect authenticated users to dashboard
  - For `publicAccessiblePages`: skip auth redirect for unauthenticated users AND skip dashboard redirect for authenticated users
  - Updated flow:
    ```
    if (!authenticated && !isPublic && !isPublicAccessible) → redirect to login
    if (authenticated && isPublic) → redirect to dashboard (login, forgot-password only)
    if (isPublicAccessible) → allow through regardless of auth state
    otherwise → apply intl middleware
    ```

- [ ] Update API route auth logic:
  - Add exceptions for public API routes: `/api/plans`, `/api/stripe/checkout`, `/api/stripe/webhook`, `/api/stripe/verify-session`, `/api/invitations/*/accept`, `/api/invitations/*/validate`
  - These should return `NextResponse.next()` without auth check

- [ ] Verify existing auth flow still works: `/login` still redirects authenticated users to dashboard, protected pages still require auth

**Commit:** `feat(middleware): add public-accessible routes for landing, pricing, checkout, invitations`

---

## Task 2: Plans API (Public)

**Files:**
- Create: `src/app/api/plans/route.ts`

**Steps:**

- [ ] `GET /api/plans` (public, no auth required):
  - Query all active plans: `prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" } })`
  - Exclude internal fields: do not return `stripePriceId` (security — don't expose Stripe IDs to the public)
  - Return shape per plan:
    ```json
    {
      "slug": "starter",
      "name": "Starter",
      "priceMonthly": 29.00,
      "priceYearly": 290.00,
      "maxBuildings": 1,
      "maxUnitsPerBuilding": 30,
      "features": ["complaints", "announcements", "messaging", "documents"],
      "trialDays": 14
    }
    ```
  - Filter out the "legacy" plan (it has `isActive: false` but double-check with `slug !== "legacy"`)
  - Cache response headers: `Cache-Control: public, max-age=3600` (1 hour — plans rarely change)

- [ ] Add response type definition in `src/types/` or inline

**Commit:** `feat(api): add public plans endpoint for pricing page`

---

## Task 3: Landing Page

**Files:**
- Modify: `src/app/[locale]/page.tsx` — replace current content with landing page
- Create: `src/components/landing/hero-section.tsx`
- Create: `src/components/landing/feature-grid.tsx`
- Create: `src/components/landing/social-proof.tsx`
- Create: `src/components/landing/landing-nav.tsx`
- Modify: `src/app/[locale]/layout.tsx` — conditional layout for public pages
- Modify: `src/i18n/en.json` — add `landing.*` keys
- Modify: `src/i18n/hu.json` — add `landing.*` keys

**Steps:**

- [ ] Read current `src/app/[locale]/page.tsx` to understand what it currently does (likely redirects to dashboard or shows a dashboard)

- [ ] Update `src/app/[locale]/layout.tsx`:
  - Detect if the current route is a public page (landing, pricing, checkout)
  - If public page: render WITHOUT the authenticated shell (no sidebar, no topbar) — just the page content with landing nav
  - If authenticated page: render with existing app shell (sidebar + topbar) as before
  - Use pathname detection to determine which layout to use

- [ ] Create `src/components/landing/landing-nav.tsx`:
  - Sticky top navigation bar with:
    - Logo/brand name (left)
    - Nav links: "Features" (anchor to section), "Pricing" (link to `/pricing`), Language switcher
    - CTA buttons: "Log In" (link to `/login`), "Get Started" (link to `/pricing`, primary button)
  - If user is authenticated: show "Go to Dashboard" instead of "Log In"
  - Responsive: hamburger menu on mobile

- [ ] Create `src/components/landing/hero-section.tsx`:
  - Headline: translated `landing.heroTitle` (e.g., "Modern Condo Management, Simplified")
  - Subheadline: translated `landing.heroSubtitle`
  - Primary CTA: "Get Started Free" → `/pricing`
  - Secondary CTA: "See Demo" or "Learn More" → scrolls to features
  - Placeholder for hero image/screenshot (use a gradient background or abstract pattern during dev)

- [ ] Create `src/components/landing/feature-grid.tsx`:
  - Section title: "Everything You Need to Manage Your Building"
  - Grid of 6-8 feature cards, each with:
    - Icon (reuse Lucide icons from sidebar: Megaphone, MessageSquare, Wallet, Wrench, FileWarning, Vote, FileText, Users)
    - Title (translated)
    - Short description (translated)
  - Features to highlight: Announcements, Messaging, Finance, Maintenance, Complaints, Voting, Documents, User Management
  - Responsive: 1 column mobile, 2 columns tablet, 3-4 columns desktop

- [ ] Create `src/components/landing/social-proof.tsx`:
  - Section with stats placeholders: "X buildings managed", "X residents connected", "X issues resolved"
  - Testimonial placeholder slots (2-3 cards with placeholder text)
  - Note in code comment: "Replace with real data and testimonials post-launch"

- [ ] Rewrite `src/app/[locale]/page.tsx`:
  - Import and render: LandingNav, HeroSection, FeatureGrid, SocialProof
  - Add a footer section with links: Pricing, Login, Language switcher, Copyright
  - Full-page layout, no sidebar

- [ ] Add i18n keys for `landing.*`:
  - `landing.heroTitle`, `landing.heroSubtitle`, `landing.getStarted`, `landing.learnMore`, `landing.featuresTitle`, `landing.feature.announcements`, `landing.feature.announcementsDesc`, `landing.feature.messaging`, `landing.feature.messagingDesc`, `landing.feature.finance`, `landing.feature.financeDesc`, `landing.feature.maintenance`, `landing.feature.maintenanceDesc`, `landing.feature.complaints`, `landing.feature.complaintsDesc`, `landing.feature.voting`, `landing.feature.votingDesc`, `landing.feature.documents`, `landing.feature.documentsDesc`, `landing.feature.users`, `landing.feature.usersDesc`, `landing.socialProofTitle`, `landing.buildingsManaged`, `landing.residentsConnected`, `landing.issuesResolved`, `landing.footerCopyright`, `landing.login`, `landing.goToDashboard`
- [ ] Add Hungarian translations for all landing keys

**Commit:** `feat(ui): add marketing landing page with hero, features, and social proof sections`

---

## Task 4: Pricing Page

**Files:**
- Create: `src/app/[locale]/pricing/page.tsx`
- Create: `src/components/pricing/plan-card.tsx`
- Create: `src/components/pricing/plan-comparison.tsx`
- Create: `src/components/pricing/billing-toggle.tsx`
- Modify: `src/i18n/en.json` — add `pricing.*` keys
- Modify: `src/i18n/hu.json` — add `pricing.*` keys

**Steps:**

- [ ] Create `src/app/[locale]/pricing/page.tsx`:
  - Public page (no auth required)
  - Renders LandingNav at top (reuse from landing page)
  - Fetches plans from `GET /api/plans` (client-side)
  - Section: headline "Simple, Transparent Pricing", subheadline
  - Renders BillingToggle, three PlanCards, PlanComparison table
  - Footer (reuse from landing)

- [ ] Create `src/components/pricing/billing-toggle.tsx`:
  - Toggle switch: "Monthly" / "Yearly"
  - Yearly shows discount badge: "Save 17%" (or calculated from actual prices)
  - State managed via parent prop: `billingPeriod`, `onToggle`

- [ ] Create `src/components/pricing/plan-card.tsx`:
  - Props: `plan`, `billingPeriod`, `isPopular` (boolean for highlighting)
  - Card layout:
    - Plan name + badge ("Most Popular" for Professional)
    - Price: show monthly or yearly based on toggle, with "/mo" or "/yr" suffix
    - If yearly: show monthly equivalent crossed out
    - Limits: "1 building", "Up to 30 units" (or "Unlimited")
    - Feature list with checkmarks
    - CTA button: "Get Started" → links to `/checkout/[planSlug]?period={billingPeriod}`
    - Highlight the Professional card with a border or accent color
  - For Enterprise: CTA could be "Contact Sales" or "Get Started" depending on if self-service is available

- [ ] Create `src/components/pricing/plan-comparison.tsx`:
  - Full feature comparison table
  - Rows: each feature (Complaints, Announcements, Messaging, Documents, Finance, Voting, Maintenance, Forum, API Access, Custom Branding, Audit Exports)
  - Columns: Starter, Professional, Enterprise
  - Checkmarks for included features, dashes for excluded
  - Limits row: "1 building / 30 units", "5 buildings / 100 units", "Unlimited"
  - Responsive: horizontal scroll on mobile, or stack to accordion

- [ ] Map feature slugs to display names via i18n: `pricing.feature.complaints`, `pricing.feature.finance`, etc.

- [ ] Add i18n keys:
  - `pricing.title`, `pricing.subtitle`, `pricing.monthly`, `pricing.yearly`, `pricing.savePercent`, `pricing.perMonth`, `pricing.perYear`, `pricing.getStarted`, `pricing.contactSales`, `pricing.mostPopular`, `pricing.buildings`, `pricing.units`, `pricing.unlimited`, `pricing.upTo`, `pricing.comparisonTitle`, `pricing.included`, `pricing.notIncluded`, `pricing.trialNote` ("All plans include a {days}-day free trial")
  - Feature display names: `pricing.feature.complaints`, `pricing.feature.announcements`, `pricing.feature.messaging`, `pricing.feature.documents`, `pricing.feature.finance`, `pricing.feature.voting`, `pricing.feature.maintenance`, `pricing.feature.forum`, `pricing.feature.apiAccess`, `pricing.feature.customBranding`, `pricing.feature.auditExports`
- [ ] Add Hungarian translations

**Commit:** `feat(ui): add pricing page with plan cards, billing toggle, and feature comparison`

---

## Task 5: Checkout Page

**Files:**
- Create: `src/app/[locale]/checkout/[planSlug]/page.tsx`

**Steps:**

- [ ] Create `src/app/[locale]/checkout/[planSlug]/page.tsx`:
  - Client component (needs to call API and redirect)
  - Extract `planSlug` from params, `period` from search params (default: "monthly")
  - On mount, prompt for email if not authenticated:
    - Show a simple form: "Enter your email to continue" with email input + "Continue to Payment" button
    - If user is authenticated, pre-fill email from session
  - On submit / on mount (if email available):
    - Show loading state: "Redirecting to secure payment..."
    - Call `POST /api/stripe/checkout` with `{ planSlug, billingPeriod, email }`
    - On success: redirect to `session.url` (Stripe Checkout)
    - On error (404 plan not found): show error message with link back to pricing
    - On error (other): show generic error with retry button

- [ ] Handle edge cases:
  - Invalid planSlug: show "Plan not found" with link to `/pricing`
  - Stripe not configured (dev environment): show "Payment is not configured" message

**Commit:** `feat(ui): add checkout page with email prompt and Stripe redirect`

---

## Task 6: Checkout Success Page

**Files:**
- Create: `src/app/[locale]/checkout/success/page.tsx`
- Create: `src/components/checkout/checkout-success.tsx`
- Modify: `src/i18n/en.json` — add `checkout.*` keys
- Modify: `src/i18n/hu.json` — add `checkout.*` keys

**Steps:**

- [ ] Create `src/app/[locale]/checkout/success/page.tsx`:
  - Public page (user is not yet logged in)
  - Reads `session_id` from URL search params
  - If no `session_id`: redirect to `/pricing`
  - Renders CheckoutSuccess component

- [ ] Create `src/components/checkout/checkout-success.tsx`:
  - Client component
  - On mount: calls `POST /api/stripe/verify-session` with `{ sessionId }`
  - States:
    - **Loading:** "Verifying your payment..." with spinner
    - **Success:** Confirmation card with:
      - Checkmark icon
      - "Payment Successful!"
      - "Your subscription has been created. Check your email for the setup invitation."
      - Plan name + details summary
      - "We've sent an invitation to {email}. Click the link in the email to set up your admin account and create your first building."
      - Secondary link: "Go to Login" → `/login`
    - **Error:** "Something went wrong verifying your payment. Your payment may have been processed — please check your email for a setup invitation. If you don't receive one within 15 minutes, contact support."
      - Retry button
      - Contact support link

- [ ] Add i18n keys:
  - `checkout.verifying`, `checkout.successTitle`, `checkout.successMessage`, `checkout.checkEmail`, `checkout.emailSentTo`, `checkout.setupInstructions`, `checkout.goToLogin`, `checkout.errorTitle`, `checkout.errorMessage`, `checkout.retry`, `checkout.contactSupport`, `checkout.redirecting`, `checkout.enterEmail`, `checkout.continueToPayment`, `checkout.planNotFound`, `checkout.backToPricing`
- [ ] Add Hungarian translations

**Commit:** `feat(ui): add checkout success page with payment verification and next steps`

---

## Task 7: i18n — Full Translation Pass

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/hu.json`

**Steps:**

- [ ] Audit all new keys added in Tasks 1-6 and verify they exist in both `en.json` and `hu.json`
- [ ] Ensure consistent key naming: `landing.*`, `pricing.*`, `checkout.*`
- [ ] Verify no hardcoded English strings remain in components — all user-facing text uses `useTranslations()` or `getTranslations()`
- [ ] Add `nav.pricing` key for landing nav link
- [ ] Add `nav.getStarted` key for CTA button
- [ ] Test both locales render without missing translation warnings in the console

**Commit:** `feat(i18n): complete English and Hungarian translations for public pages`
