# Self-Serve Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Login page's signup tab functional. A new visitor can fill the four-field form (név, email, ház neve, jelszó), receive a verification email, and after clicking the link land in the app as the chair of a freshly-created Building inside a TRIALING Subscription on the Képviselő plan. Replaces the current visual-only redirect to `/pricing`.

**Architecture:** Five phases. Phase 1 lays schema (verification tokens, `emailVerifiedAt`, trial-end status fields on Subscription). Phase 2 implements the register server action that atomically creates User + Subscription + Building + verification token + queued email. Phase 3 builds the verify-email page and gate. Phase 4 wires the Login signup tab to the register action. Phase 5 ships the trial-end read-only-then-archive policy via worker jobs (deferred to a follow-up commit; only the schema flag and a banner ship in the main work).

**Tech Stack:** Next.js 15, Prisma, NextAuth v5 beta, BullMQ on Redis, `nodemailer` (already a dep), bcryptjs (already a dep), Cloudflare Turnstile (added Phase 4 — bot protection on the signup endpoint).

**Spec source:** Decisions captured in conversation 2026-04-28. **Augments** `docs/plans/2026-03-30-subscriptions-schema-invitations-gating.md` (the existing accept-invitation flow stays for invited users; this plan adds the parallel self-serve path). Cross-refs: `docs/plans/2026-04-28-feature-gating-enforcement.md` (trial scope = Képviselő-level features), `docs/plans/2026-04-27-roles-legal-alignment.md` (chair flag on UserBuilding).

**Non-goals:**
- Replacing the accept-invitation flow. Invited users still register via `/accept-invitation/[token]`; only the *self-serve* / *anonymous-visitor* path is new.
- Stripe customer pre-creation at signup. Stripe customer is created at first paid conversion.
- Multi-step plan picker before signup. The trial subscription gets `planId = kepviselo` automatically.
- Address / KYC / tax-ID collection at signup. Captured later via an onboarding wizard (separate plan).
- Onboarding wizard itself (separate plan, depends on the Roles legal-alignment phase).

---

## Decisions captured

| Decision | Choice |
|---|---|
| Trial end (day 15) | Read-only for 30 days, then archive (data retained 90 days, then purged) |
| Plan at signup | Default to **Képviselő** tier; conversion is one-click |
| Email verification | **Required before first login** — show "check your email" page after signup |
| Signup fields | **Minimal per design** — név, email, ház neve, jelszó (4 fields) |
| Bot protection | Cloudflare Turnstile on the register endpoint |
| Stripe customer creation | Deferred until first paid conversion |
| Onboarding | Minimal post-verification wizard (separate plan) |

---

## File Structure — What Changes

```
prisma/
└── schema.prisma                                    # Phase 1: User.emailVerifiedAt, EmailVerificationToken, Subscription.readOnlyAt + archivedAt
src/
├── lib/
│   ├── register.ts                                  # NEW: register() server-side helper
│   ├── email-verification.ts                        # NEW: token gen + verify
│   └── email.ts                                     # MODIFY: add sendVerificationEmail()
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── register/route.ts                    # NEW: POST endpoint with Turnstile check
│   └── [locale]/
│       ├── verify-email/
│       │   ├── [token]/
│       │   │   └── page.tsx                         # NEW: verify + sign-in
│       │   └── pending/
│       │       └── page.tsx                         # NEW: "check your inbox" page
├── components/auth/
│   └── login-form.tsx                               # MODIFY: signup branch calls register
worker/
└── jobs/
    ├── trial-readonly.ts                            # NEW (Phase 5, deferred): cron — flips trial subs to read-only on day 15
    └── trial-archive.ts                             # NEW (Phase 5, deferred): cron — archives subs read-only > 30 days
src/app/[locale]/login/page.tsx                      # MODIFY: pass building name through if signup
src/i18n/{hu,en}.json                                # MODIFY: add register.* keys + verifyEmail.* keys
```

---

## Phase 1: Schema additions

**Goal:** Add the data model pieces all subsequent phases rely on. No app behavior changes yet.

- [ ] **Step 1: Modify `User`**:
  ```prisma
  model User {
    // ...existing...
    emailVerifiedAt        DateTime?       // null = unverified, blocks login per Phase 3
    emailVerificationTokens EmailVerificationToken[]
  }
  ```

- [ ] **Step 2: Add `EmailVerificationToken`**:
  ```prisma
  model EmailVerificationToken {
    id         String    @id @default(cuid())
    user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    userId     String
    tokenHash  String    @unique          // SHA-256 of the bare token
    expiresAt  DateTime
    consumedAt DateTime?
    createdAt  DateTime  @default(now())
    @@index([userId])
    @@index([expiresAt])
  }
  ```

- [ ] **Step 3: Modify `Subscription` for trial-end state**:
  ```prisma
  model Subscription {
    // ...existing...
    readOnlyAt   DateTime?   // set on trial expiry; UI degrades to read-only
    archivedAt   DateTime?   // set 30 days after readOnlyAt; data retained 90 more days
  }
  ```

- [ ] **Step 4: Migration + commit**
  ```bash
  npx prisma migrate dev --name phase1-self-serve-registration-schema
  git commit -m "feat(register): phase 1 — email verification + trial-end schema"
  ```

---

## Phase 2: register helper + endpoint

**Goal:** A pure function `register(args)` that atomically creates User + Subscription + Building + verification token, then queues a verification email. Wrapped by an API route (`POST /api/auth/register`) for the Login page to call.

- [ ] **Step 1: `src/lib/register.ts`**:
  ```ts
  export interface RegisterInput {
    name: string;
    email: string;
    password: string;
    buildingName: string;
    locale: "hu" | "en";
  }

  export async function register(input: RegisterInput): Promise<{ userId: string; verificationToken: string }> {
    // ... validate (zod) — email format, password ≥ 10 chars, names trimmed
    // ... duplicate-email check
    // ... bcrypt hash
    // ... transaction:
    //   - create User
    //   - create Subscription { ownerId: user.id, planId: <kepviselo>, status: TRIALING, trialEndsAt: now + 14d }
    //   - create Building { name, subscriptionId, address: "", city: "", zipCode: "" }   // address filled in onboarding
    //   - create UserBuilding { userId, buildingId, role: BOARD_MEMBER, isChair: true }
    //   - create EmailVerificationToken { tokenHash: sha256(rawToken), expiresAt: now + 24h }
    // ... return { userId, verificationToken: rawToken }
  }
  ```
  Notes:
  - `planId` looked up by `slug = "kepviselo"` from the Plan table.
  - Building gets sentinel empty address fields; onboarding wizard fills them.
  - User is automatically the chair (`isChair: true`); the legal-alignment plan's partial unique index allows exactly one chair per building, which is satisfied.

- [ ] **Step 2: `src/lib/email-verification.ts`**:
  ```ts
  export function generateVerificationToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
  }
  export async function consumeToken(rawToken: string): Promise<{ userId: string } | null> {
    const hash = createHash("sha256").update(rawToken).digest("hex");
    return await prisma.$transaction(async (tx) => {
      const row = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
      if (!row || row.consumedAt || row.expiresAt < new Date()) return null;
      await tx.emailVerificationToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
      await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
      return { userId: row.userId };
    });
  }
  ```

- [ ] **Step 3: `src/lib/email.ts` — add `sendVerificationEmail({ to, name, locale, token })`**. Body localized; link is `${BASE_URL}/${locale}/verify-email/${rawToken}`. 24-hour expiry called out in the body.

- [ ] **Step 4: `src/app/api/auth/register/route.ts`**:
  - `POST` handler.
  - Verifies Cloudflare Turnstile token (deferred until env keys set; gate behind a feature flag for dev).
  - Calls `register(...)`, queues verification email, returns `{ ok: true, email }`.
  - On duplicate email: returns `{ ok: false, error: "email-taken" }` (HTTP 409).
  - Rate-limited (existing `src/lib/rate-limit.ts` if present; else simple Redis counter).

- [ ] **Step 5: Audit log**. Each registration writes `create.User` + `create.Subscription` + `create.Building` audit entries (cross-ref audit-ui plan).

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(register): phase 2 — register helper + API endpoint"
  ```

---

## Phase 3: Verify-email pages + auth gate

**Goal:** After signup, user lands on `/verify-email/pending`. Email link goes to `/verify-email/[token]` which consumes the token, marks the user verified, and signs them in. Login is blocked for unverified users.

- [ ] **Step 1: `/[locale]/verify-email/pending/page.tsx`**: server component. Reads `?email=` query param; shows "Köszönjük! Küldtünk egy megerősítő linket a {email} címre. 24 órán belül használd." Includes a "Resend" button (calls `/api/auth/register/resend-verification` — small additional endpoint).

- [ ] **Step 2: `/[locale]/verify-email/[token]/page.tsx`**: server component. On render, calls `consumeToken(token)`. If success: NextAuth `signIn("verification", { userId })` (a custom credential provider that accepts userId for post-verify auto-sign-in) and redirect to `/dashboard`. If failure: render an "Érvénytelen vagy lejárt link — kérj újat" page with the resend form.

- [ ] **Step 3: NextAuth gate**. In `src/lib/auth-options.ts`, augment the credentials provider's `authorize` callback:
  ```ts
  if (!user.emailVerifiedAt) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }
  ```
  Login form catches the error and shows: "Még nincs visszaigazolva az emailcímed. {Resend link}".

- [ ] **Step 4: Resend endpoint** at `/api/auth/register/resend-verification` — accepts email, generates a new token, voids any prior tokens for that user, sends the email. Rate-limited to 1 send / minute / email.

- [ ] **Step 5: i18n keys** under `verifyEmail.*` (HU + EN) for all the pages and error messages.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(register): phase 3 — verify-email pages + auth gate"
  ```

---

## Phase 4: Wire Login signup tab + Turnstile

**Goal:** Replace the `/pricing` redirect in `LoginForm` with a real fetch to `/api/auth/register`. On success, push to `/verify-email/pending?email=...`. Add Turnstile widget to the signup tab.

- [ ] **Step 1: `LoginForm` signup branch**: replace the `router.push('/pricing?...')` with:
  ```ts
  const res = await fetch(`/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, buildingName: houseName, locale, turnstileToken }),
  });
  if (res.status === 409) { setError(t("auth.emailTaken")); return; }
  if (!res.ok) { setError(t("common.error")); return; }
  router.push(`/verify-email/pending?email=${encodeURIComponent(email)}`);
  ```

- [ ] **Step 2: Cloudflare Turnstile**:
  - Add `@marsidev/react-turnstile` (lightweight wrapper) or roll a small inline component.
  - Site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; secret in `TURNSTILE_SECRET_KEY`.
  - Widget rendered above the submit button on the signup tab only.
  - In dev (no keys set), bypass: skip the verification call.

- [ ] **Step 3: Loading + error UX**: existing `loading` state covers the spinner. Add specific copy for `EMAIL_NOT_VERIFIED` on the login tab side (Phase 3 error path).

- [ ] **Step 4: Telemetry / audit**. The audit log already captures `create.User` etc. from Phase 2. Optionally add a metric for signup attempts vs. successes.

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(register): phase 4 — wire Login signup tab + Turnstile"
  ```

---

## Phase 5 (deferred to follow-up): Trial-end read-only + archive

**Goal:** On day 15, flip TRIALING subs to read-only (set `Subscription.readOnlyAt`); on day 45 (30 days into read-only), set `archivedAt` and stop write access entirely. Data retained 90 days from `archivedAt`, then purged.

This phase ships **after** the main signup work lands. The schema flags from Phase 1 are already there; the workers and UI banners come now.

- [ ] **Step 1: `worker/jobs/trial-readonly.ts`** — daily cron. Finds Subscriptions where `subscriptionStatus = TRIALING && trialEndsAt < now && readOnlyAt IS NULL`. Sets `readOnlyAt = now`, status remains TRIALING (or new status `READ_ONLY` if the enum is extended).

- [ ] **Step 2: `worker/jobs/trial-archive.ts`** — daily cron. Finds Subscriptions where `readOnlyAt < now - 30 days && archivedAt IS NULL`. Sets `archivedAt = now`. Audit-log this. Send a final-warning email to the owner.

- [ ] **Step 3: Read-only enforcement**. A middleware-level check on every mutating server action: if `Subscription.readOnlyAt < now`, throw `TrialExpiredError`. UI catches it, shows the upgrade modal with a "Reactivate by paying" CTA.

- [ ] **Step 4: Banner**. Sidebar / topbar shows a moss-banner with "Próbaidőszakod {N} napon belül lejár" countdown when `trialEndsAt < now + 3 days`. After expiry: red banner "A munkamenet csak olvasható — fizetést követően folytathatod".

- [ ] **Step 5: Purge worker** — `worker/jobs/trial-purge.ts`. Subs `archivedAt < now - 90 days` → cascade-delete the Subscription, its Building(s), Units, etc. Audit-log heavily. Document the legal retention exceptions (any AuditLog rows with the `governance forever` retention from the audit-ui plan stay).

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(register): phase 5 — trial-end read-only + archive workers"
  ```

---

## Out of scope (tracked for follow-up)

- **Onboarding wizard** post-verification — separate plan; collects address, mérőóra setup, invites residents.
- **Plan downgrade UI** — covered in feature-gating plan.
- **OAuth-based registration** (Google / Facebook). Login page has the buttons disabled; wiring is a separate plan.
- **Recovery / abandoned-signup re-engagement emails** ("you started signing up 3 days ago…") — defer until first signal of need.
- **Bot signup detection beyond Turnstile** — IP velocity, email heuristics. Add only if abuse appears.
- **i18n in verification email subjects** — covered, but localized link previews / Apple-Mail markdown nuances are out of scope.

---

## Acceptance criteria

This plan is complete when:

1. Filling the Login signup tab with valid data produces a 200 from `/api/auth/register` and routes the user to `/verify-email/pending?email=...`.
2. The user receives a verification email within **30 s p95**; the link contains an unguessable token; the link expires after **24 h**.
3. Clicking the link from the email signs the user into the app and lands them on `/dashboard`.
4. Login attempts before verification fail with a `Még nincs visszaigazolva az emailcímed` message and a one-click resend.
5. Resend rate-limited to 1 / minute / email; spamming returns 429.
6. Registering with an existing email returns 409 and surfaces "Ez az email már regisztrált" in the form.
7. The newly-created `Subscription` has `subscriptionStatus = TRIALING`, `planId = <kepviselo>`, `trialEndsAt = now + 14d`.
8. The newly-created `Building` is owned by that subscription; the user has a `UserBuilding` with `role = BOARD_MEMBER, isChair = true`.
9. Cloudflare Turnstile token validation runs in production; dev mode bypasses cleanly.
10. Audit log contains `create.User`, `create.Subscription`, `create.Building` rows for the registration.

When all ten hold, the signup tab is fully functional. Phase 5 (read-only / archive) ships as a follow-up.
