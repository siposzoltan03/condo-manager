# Condo Manager — Audit Findings

**Date:** 2026-03-30
**Branch:** `feat/multi-building`
**Audited by:** Automated subagents (security + UX)

---

## Table of Contents

- [Security Findings](#security-findings)
  - [Critical](#critical)
  - [High](#high)
  - [Medium](#medium)
  - [Low](#low)
  - [Info](#info)
- [UX Findings](#ux-findings)
  - [Critical](#critical-1)
  - [High](#high-1)
  - [Medium](#medium-1)
  - [Low](#low-1)
- [Summary](#summary)

---

## Security Findings

### Critical

#### S1. JWT Session Update Accepts Unvalidated Role Escalation

- **File:** `src/lib/auth-options.ts:110-118`
- **Description:** The JWT callback blindly trusts `updateData.activeBuildingId` and `updateData.activeRole` from the client-side `updateSession()` call. A malicious user can call `updateSession({ activeBuildingId: "any-id", activeRole: "SUPER_ADMIN" })` from the browser console to escalate privileges. Every subsequent API call via `requireBuildingContext()` would then trust the forged role and building.
- **Fix:** In the JWT callback, when `trigger === "update"`, perform a server-side database lookup to verify building membership and retrieve the actual role from the `UserBuilding` table. Never trust `activeRole` from the client.

#### S2. Hardcoded Fallback Secret for Ballot Receipt Hashes

- **File:** `src/app/api/voting/votes/[id]/ballot/route.ts:133`
- **Description:** The code uses `process.env.BALLOT_SECRET ?? "default-ballot-secret"`. If `BALLOT_SECRET` is not set (it is absent from `.env` and `.env.example`), the hardcoded string is used, making ballot receipt hashes predictable and forgeable.
- **Fix:** Add `BALLOT_SECRET` to the required environment variables in `src/lib/env.ts` and remove the fallback. Generate a strong random secret for production.

---

### High

#### S3. VAPID Private Key in `.env`

- **File:** `.env:21`
- **Description:** The `.env` file contains an actual VAPID private key. While `.env` is in `.gitignore`, if it was ever committed to git history, the key is exposed. `NEXTAUTH_SECRET` is also set to the placeholder `"your-secret-key-change-in-production"`.
- **Fix:** Rotate the VAPID keys. Verify git history with `git log --all --full-history -- .env`. Add a CI check to ensure `.env` is never committed.

#### S4. Audit Logs Not Scoped to Building

- **Files:** `src/app/api/audit-logs/route.ts`, `src/lib/audit.ts`
- **Description:** The audit log GET endpoint requires ADMIN role but queries all audit logs globally without filtering by `buildingId`. An admin of Building A can view audit logs from Building B, including sensitive actions like user creation, financial transactions, and complaint details. The `AuditLog` model has no `buildingId` field.
- **Fix:** Add a `buildingId` field to the `AuditLog` model, populate it at creation time, and filter by the caller's active building in the GET endpoint.

#### S5. Conversations Not Scoped to Buildings

- **File:** `src/app/api/messages/conversations/route.ts`
- **Description:** The conversations API creates and lists conversations without building scoping. A user in Building A can start a conversation with any active user in the system by knowing their user ID. The POST endpoint validates only that participant IDs exist in the `User` table, not that they share a building.
- **Fix:** Verify all participants share the same building as the current user when creating conversations. Filter GET results to the current building context.

#### S6. No Rate Limiting on Most API Endpoints

- **Files:** All API routes except login and password reset
- **Description:** Rate limiting is only applied to login (5 per 15 min) and forgot-password (3 per hour). All other endpoints — creating forum posts, sending messages, filing complaints, creating financial entries — have no rate limiting, enabling spam, resource exhaustion, and DoS.
- **Fix:** Add rate limiting middleware to all mutation endpoints (POST/PATCH/DELETE). Consider a global per-user rate limit at the middleware level.

---

### Medium

#### S7. Sensitive Debug Logging in Authentication

- **File:** `src/lib/auth-options.ts:38,47,51,53,62`
- **Description:** The auth flow logs sensitive information: password validity (`true/false`), user email addresses on rate limit and not-found conditions, and bcrypt type information.
- **Fix:** Remove or gate behind `NODE_ENV !== "production"`. At minimum, remove the password validity log.

#### S8. Document File URL Injection (Stored SSRF / Open Redirect)

- **Files:** `src/app/api/documents/route.ts:157`, `src/app/api/documents/[id]/versions/route.ts:43`
- **Description:** Document creation and versioning endpoints accept `fileUrl` without validation. A malicious user could store `file:///etc/passwd`, `javascript:alert(1)`, or internal network URLs. When other users click to download, they may be redirected to attacker-controlled destinations.
- **Fix:** Validate `fileUrl` against an allowlist of domains or require it to match an expected upload storage pattern. At minimum, enforce `http:` or `https:` protocol.

#### S9. No Input Length Validation on Text Fields

- **Files:** Multiple API routes (forum topics, replies, announcements, complaints, messages, meetings)
- **Description:** Many endpoints accept text input without length limits, enabling storage abuse and potential DoS through extremely large payloads.
- **Fix:** Add explicit length limits (e.g., titles max 200 chars, bodies max 10,000 chars).

#### S10. Weak NEXTAUTH_SECRET Placeholder

- **File:** `.env:8`
- **Description:** `NEXTAUTH_SECRET` is set to `"your-secret-key-change-in-production"` in both `.env` and `.env.example`. The `env.ts` validation checks existence but not that it differs from the placeholder.
- **Fix:** Add a production guard in `validateEnv()` that rejects the placeholder value.

#### S11. CSP Allows `unsafe-inline` and `unsafe-eval`

- **File:** `nginx/nginx.conf:18`
- **Description:** The Content-Security-Policy includes `'unsafe-inline' 'unsafe-eval'` for `script-src`, significantly weakening XSS protection.
- **Fix:** Use nonce-based CSP with Next.js. Remove `unsafe-eval`. Consider `strict-dynamic` with nonces.

#### S12. Password Reset Rate Limit Keyed on Raw Token

- **File:** `src/app/api/auth/reset-password/route.ts:24`
- **Description:** The rate limit key is `auth:reset:${token}`. An attacker brute-forcing different token values gets 5 attempts per unique token, making the rate limit ineffective.
- **Fix:** Rate limit by IP address or a combination of IP and token prefix.

---

### Low

#### S13. Seed Script Uses Weak Password

- **File:** `prisma/seed.ts:59`
- **Description:** All seed users use `"password123"`. The seed is protected against production execution, but if loaded in staging or an exposed dev environment, all accounts are trivially compromised.
- **Fix:** Consider randomized passwords for non-local environments.

#### S14. Health Endpoint Returns 401

- **File:** `src/app/api/health/route.ts`
- **Description:** The health check endpoint requires authentication due to middleware, which may break load balancer health checks.
- **Fix:** Add `/api/health` to the public path exception list in middleware.

#### S15. Contractor Data Not Building-Scoped

- **File:** Prisma schema — `Contractor` model
- **Description:** Contractors are global entities visible across all buildings. Users in one building can see contractor details (contact info, tax IDs) added by another building's admin.
- **Fix:** Add a `buildingId` field if per-building isolation is desired.

---

### Info

#### S16. No CSRF Protection Beyond SameSite Cookies

- **Description:** The application relies on `SameSite=lax` cookies. Generally acceptable for a modern SPA, but consider explicit CSRF tokens for form-based submissions if the threat model warrants it.

#### S17. Docker Compose Exposes Dev Database Credentials

- **File:** `docker-compose.yml:34`
- **Description:** Database credentials are hardcoded. The file header notes dev-only use, and the port is bound to `127.0.0.1`, which is appropriate. Use secrets management for staging/production.

---

## UX Findings

### Critical

#### U1. No Toast/Notification System for User Feedback

- **Files:** All form components
- **Description:** The application has no toast notification infrastructure (no sonner, react-hot-toast, or similar). After successful form submissions, the modal simply closes with no success feedback. Users must infer success from the list refreshing.
- **Fix:** Install a toast library (e.g., `sonner`) and add success toasts after every mutation. Also add error toasts for the many silent `catch {}` blocks.

#### U2. No Error Boundary Anywhere

- **Files:** `src/app/[locale]/layout.tsx` — no `error.tsx` files exist
- **Description:** No React error boundaries or Next.js `error.tsx` files anywhere. If any component throws a runtime error, the entire page white-screens with no recovery path.
- **Fix:** Add `error.tsx` at the `[locale]` level and per-section with user-friendly error messages and a retry button.

#### U3. Messages Page Not Responsive on Mobile

- **File:** `src/components/messages/messages-page.tsx:79`
- **Description:** The messages page uses a fixed `w-80` conversation list panel with no responsive handling. On mobile, the conversation list alone consumes the full viewport, leaving no room for the message thread.
- **Fix:** Show conversation list full-width on small screens; when a conversation is selected, show the message thread full-width with a back button. Toggle at the `md` or `lg` breakpoint.

---

### High

#### U4. Modals Lack Keyboard Trap and Escape-to-Close

- **Files:** All ~10 modal dialogs (complaint-form, announcement-form, create-vote-modal, ReportIssueModal, user-form, building-list, new-conversation-modal, upload-document-modal, create-meeting-modal)
- **Description:** No modal handles Escape to close, and none implement focus trapping. Tab key cycles focus to elements behind the backdrop.
- **Fix:** Create a shared `Modal` wrapper with Escape handling, focus trap, `role="dialog"`, `aria-modal="true"`, and focus restoration on close.

#### U5. Destructive Actions Use `window.confirm()` and `alert()`

- **Files:** `src/components/admin/building-list.tsx:110-122`, `src/components/maintenance/ScheduledMaintenanceCalendar.tsx:141`, `src/components/maintenance/ContractorDetail.tsx:74`, `src/components/forum/topic-detail.tsx:125`
- **Description:** Delete operations use browser-native `confirm()` dialogs. Error handling uses `alert()`. These are unstyled, non-localizable, and block the main thread. User deactivation in `user-list.tsx:119-131` has no confirmation at all.
- **Fix:** Build a custom `ConfirmDialog` component that respects the design system and i18n. Add confirmation for user deactivation.

#### U6. Forum and Documents Sidebars Not Responsive

- **Files:** `src/components/forum/forum-page.tsx:120`, `src/components/documents/documents-page.tsx:184-192`
- **Description:** Fixed `w-64` sidebars alongside content with no responsive classes. On mobile, content overflows or the sidebar compresses the main content.
- **Fix:** Hide sidebars on mobile with `hidden lg:block` and add a filter button/drawer for mobile.

#### U7. Pervasive Silent Error Swallowing

- **Files:** 20+ components including `complaint-list.tsx:79`, `voting-page.tsx:69`, `resident-dashboard.tsx:147`, `messages-page.tsx:30`, `TicketList.tsx:63`
- **Description:** At least 20+ `catch {}` blocks silently discard errors. When API calls fail, users see loading finish with empty lists and no indication of failure. Dashboard silently shows "0" for counts on fetch failure.
- **Fix:** Set error state and display it. Use the toast system (U1) for non-blocking error notifications.

#### U8. Hardcoded English Strings in Internationalized App

- **Files:** `src/components/admin/user-form.tsx:162-292`, `src/components/layout/topbar.tsx:19-24`
- **Description:** The user form contains numerous hardcoded English strings bypassing i18n: "Edit User", "Create User", "Name", "Temporary Password", "Role", "Unit", etc. Topbar role labels are also hardcoded.
- **Fix:** Move all user-visible strings to translation files. The app supports Hungarian (hu) and English (en).

---

### Medium

#### U9. Two Conflicting Color Systems

- **Files:** Across all components (202 occurrences of `bg-[#002045]` across 58 files)
- **Description:** Older pages use `#002045` with `rounded-md` buttons. Admin/settings pages use Tailwind's `blue-600`/`blue-500` with `rounded-lg`. Focus ring colors also differ.
- **Fix:** Define the brand color as a Tailwind theme extension and standardize.

#### U10. Inconsistent Button Border Radius

- **Files:** 348 border-radius class occurrences across 76 components
- **Description:** Mix of `rounded-md`, `rounded-lg`, `rounded-xl`, and `rounded-2xl` with no discernible pattern.
- **Fix:** Establish a system: e.g., `rounded-lg` for buttons, `rounded-xl` for cards/modals, `rounded-full` for badges.

#### U11. Page Title Size Inconsistency

- **Files:** Multiple list pages
- **Description:** Some pages use `text-4xl font-extrabold`, others `text-2xl font-bold`. No shared `PageHeader` component.
- **Fix:** Standardize heading sizes via a shared component.

#### U12. Loading States Are Inconsistent

- **Files:** All list/detail components
- **Description:** Some use spinners, most use plain "Loading..." text, finance section uses skeleton loaders.
- **Fix:** Create a shared loading component. Use skeleton loaders for list/table views consistently (finance module provides a good pattern).

#### U13. No Top Padding Below Sticky Topbar

- **File:** `src/components/layout/app-shell.tsx:55`
- **Description:** Main content has `pt-0` while topbar is `sticky top-0 h-16`. Content renders behind the header. On mobile, the hamburger button overlaps the topbar area.
- **Fix:** Add `pt-16` to account for the 64px topbar.

#### U14. Search Fires on Every Keystroke

- **Files:** `src/components/complaints/complaint-list.tsx:90-93`, `src/components/maintenance/TicketList.tsx:74-77`
- **Description:** Complaint list and maintenance ticket list trigger API fetches on every keystroke with no debounce. Other components (user list, announcements, documents) correctly implement 300ms debounce.
- **Fix:** Add the same debounce pattern used in `user-list.tsx:96-102`.

#### U15. Minimal ARIA Attributes

- **Files:** All components (only 19 ARIA attribute occurrences across 12 files)
- **Description:** Icon-only buttons lack `aria-label`. Modals lack `role="dialog"`. Tab navigation lacks ARIA tab roles.
- **Fix:** Audit all interactive elements. Prioritize icon-only buttons, modals, and tab interfaces.

---

### Low

#### U16. Notification Dropdown Lacks Keyboard Navigation

- **File:** `src/components/layout/notification-bell.tsx`
- **Description:** No arrow key navigation, no Escape-to-close on the notification dropdown.
- **Fix:** Add Escape-to-close and arrow key navigation.

#### U17. Voting Page Lacks Pagination

- **File:** `src/components/voting/voting-page.tsx:63`
- **Description:** Fetches `?limit=50` with no pagination. Older entries silently dropped beyond 50.
- **Fix:** Add pagination or "load more" pattern.

#### U18. Finance Overview Makes Redundant API Call

- **File:** `src/components/finance/finance-overview.tsx:50-53`
- **Description:** Fetches both `?page=${currentPage}&limit=10` and `?page=1&limit=50` simultaneously, duplicating data for the trends chart.
- **Fix:** Fetch once and paginate client-side, or use a dedicated trends endpoint.

#### U19. QuickAction Renders Redundant Icon

- **File:** `src/components/dashboard/admin-dashboard.tsx:228-237`
- **Description:** Renders both a hardcoded `PlusCircle` icon and the caller-provided `icon` prop.
- **Fix:** Remove one of the two icons.

#### U20. Login Email Label Partially Hardcoded

- **File:** `src/components/auth/login-form.tsx:69`
- **Description:** Renders `{tCommon("email")} address` — mixing translated and hardcoded English text.
- **Fix:** Use a single translation key like `auth.emailAddress`.

#### U21. Missing `useEffect` Dependencies

- **Files:** `src/components/dashboard/admin-dashboard.tsx:105`, `src/components/dashboard/resident-dashboard.tsx:154`, `src/components/admin/building-list.tsx:52`
- **Description:** Several `useEffect` hooks have empty dependency arrays but reference state/functions that should be listed.
- **Fix:** Wrap functions in `useCallback` and add to deps, or justify eslint-disable.

#### U22. No Per-Page Document Titles

- **Files:** All pages
- **Description:** Root metadata sets `title: "Condo Manager"` but individual pages never update it. All browser tabs show the same title.
- **Fix:** Add metadata exports per page: "Complaints - Condo Manager", "Finance - Condo Manager", etc.

---

## Summary

| Category | Critical | High | Medium | Low | Info | Total |
|----------|----------|------|--------|-----|------|-------|
| Security | 2 | 4 | 6 | 3 | 2 | **17** |
| UX       | 3 | 5 | 7 | 7 | — | **22** |
| **Total** | **5** | **9** | **13** | **10** | **2** | **39** |

### Top 5 Priority Actions

1. **Fix JWT session update** (S1) — immediate privilege escalation vector
2. **Remove hardcoded ballot secret** (S2) — ballot integrity at risk
3. **Scope audit logs and conversations to buildings** (S4, S5) — cross-building data leakage
4. **Add toast notification system** (U1) — foundation for all user feedback
5. **Add error boundaries** (U2) — prevent white-screen crashes
