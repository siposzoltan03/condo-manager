# Audit + Notify call-site exceptions

Per the refactor plan §3 Phase E + §4 #4 ("Services own audit + notify"),
every `createAuditLog` and `notify()` call in `src/app/api/` should
either live in a domain events module (e.g. `lib/voting/events.ts`) or
be listed here with a one-line justification.

This document is the authoritative exceptions list. The Phase E sweep
moved marketplace, voting, documents, and selected finance/maintenance
routes into their respective `events.ts` modules. The sites below are
either (a) intentionally still at the route layer, (b) waiting on a
future domain events module, or (c) flagged as known bugs to fix in
separate work.

## Categorically intentional (stay at the route layer)

These fire from contexts where there's no service to move them into, or
they happen *before* a service would be reached:

| Site | Why it stays |
|---|---|
| `src/app/api/cron/maintenance-scheduled/route.ts` | System cron job. No user session; audit fires from the scheduling layer itself. |
| `src/app/api/profile/2fa/disable/route.ts` | Pre-session-mutation security event. The audit is the event. |
| `src/app/api/profile/2fa/verify/route.ts` | Same as 2fa/disable — auth-state audit at the boundary. |
| `src/app/api/profile/sessions/[id]/revoke/route.ts` | Session revocation audit fires as part of the auth-state change. |
| `src/app/api/contractor/billing/checkout/route.ts` | Audit in the dev-override branch is a billing-state event tied to Stripe webhook dedupe; the production branch already routes through the webhook handlers which own the audit. |
| `src/app/api/contractor/onboarding/finalize/route.ts` | Tied to NAV validation and activation orchestration — neither is a domain service yet. |
| `src/app/api/finance/import/route.ts` | Bulk-import audit is a one-shot "this batch was applied"; not a per-domain-event audit. |

## Pending future events modules

These have a clear domain home but need a small `events.ts` module
created. Tracked as follow-up:

| Site | Future destination |
|---|---|
| `src/app/api/maintenance/tickets/route.ts` (POST audit) | `lib/maintenance/events.ts` → `ticketCreated()` |
| `src/app/api/maintenance/tickets/[id]/assign/route.ts` (audit + notify) | `lib/maintenance/events.ts` → `ticketAssigned()` |
| `src/app/api/maintenance/tickets/[id]/rate/route.ts` (audit) | `lib/maintenance/events.ts` → `ticketRated()` |
| `src/app/api/maintenance/tickets/[id]/publish/route.ts` (audit) | `lib/marketplace/events.ts` → `publicationCreated()` (already partially staged) |
| `src/app/api/maintenance/tickets/[id]/publish/close/route.ts` (audit) | `lib/marketplace/events.ts` → `publicationClosed()` |
| `src/app/api/maintenance/tickets/[id]/comments/route.ts` (notify) | `lib/maintenance/events.ts` → `ticketCommentAdded()` |
| `src/app/api/board-resignations/[id]/acknowledge/route.ts` (audit + notify) | `lib/voting/events.ts` → `boardResignationAcknowledged()` |
| `src/app/api/units/route.ts` + `src/app/api/units/[id]/route.ts` (audit) | new `lib/units/events.ts` → `unitCreated()`, `unitUpdated()`, `unitDeleted()` |
| `src/app/api/users/route.ts` + `src/app/api/users/[id]/route.ts` (audit) | new `lib/users/events.ts` (or extend profile-dal) → `userInvited()`, `userUpdated()`, `userDeactivated()` |

## Known bugs

| Site | Bug |
|---|---|
| `src/app/api/contractor/auth/signup/route.ts` (via `lib/contractor/events.ts → contractorOrgCreated`) | `AuditLog.userId` has a FK to the condo `User` table, but signup passes a freshly-created `ContractorUser.id`. The `.catch(() => undefined)` wrapper has been silently swallowing FK violations since signup shipped. Locked in with a comment + `expect(audit).toBeNull()` in `tests/integration/contractor-signup.test.ts`. Fix requires a policy decision (system-user id? polymorphic actor? drop the audit on signup?) — out of scope for the layering refactor. |

## Stop condition (rephrased)

`grep -r "createAuditLog\|notify(" src/app/api/` returns only entries in
this file (with the comment-only matches in mocked routes excluded).
