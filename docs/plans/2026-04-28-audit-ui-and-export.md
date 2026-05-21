# Audit UI and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the audit log a first-class compliance surface. Three concerns drive this:
1. **Tht. § 27/A** — jegyző fines for unlawful condo operation; the audit log is evidence of officer behaviour.
2. **GDPR Art. 15** — every user has a right to access data about themselves, including who did what to their record.
3. **AUDITOR / FB-tag role** (introduced by `docs/plans/2026-04-27-roles-legal-alignment.md`) — read-only auditor needs cross-module visibility.

Today the `AuditLog` model exists but write paths are sparse, there's no read interface, no export, and no retention policy.

**Architecture:** Five phases. Phase 1 instruments writes broadly with a typed helper, redaction whitelist, and an eslint rule that fails CI for new mutating actions missing audit. Phase 2 builds the admin read UI. Phase 3 adds the per-user GDPR Art. 15 surface. Phase 4 streams large exports as worker jobs. Phase 5 introduces retention rules + legal hold + a monthly archive partition.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, BullMQ on Redis, Tailwind v4, NextAuth v5.

**Spec source:** Audit findings dated 2026-04-28; cross-references `docs/plans/2026-04-27-roles-legal-alignment.md` (AUDITOR role, vendor anonymization, impersonation note).

**Non-goals:**
- Tamper-evident chain (Merkle / blockchain) — audit is append-only at DB level; tamper-resistance is via DB hardening.
- Real PKI signing of exports (HMAC + timestamp here; real PKI is a separate plan).
- Pulling audit data from external systems (Stripe, Resend, Cloudflare).
- Real-time audit streaming to a SIEM.
- AI anomaly detection on audit data.
- Replacing Sentry / observability tools — this is compliance audit, not error tracking.

---

## File Structure — What Changes

```
src/
├── lib/
│   ├── audit.ts                              # NEW: audit.log() helper, redaction
│   ├── audit-actions.ts                      # NEW: canonical action vocabulary
│   └── audit-redaction.ts                    # NEW: per-model serializeForAudit()
├── app/
│   ├── [locale]/
│   │   ├── admin/
│   │   │   └── audit/
│   │   │       └── page.tsx                  # NEW: filter strip + paginated table
│   │   └── settings/
│   │       └── activity/
│   │           └── page.tsx                  # NEW: per-user GDPR Art. 15 view
│   └── api/
│       └── audit/
│           ├── search/route.ts               # NEW: filtered query
│           ├── export/route.ts               # NEW: enqueues export job
│           └── export/[id]/download/route.ts # NEW: signed-bundle GET
worker/
└── jobs/
    ├── audit-archive.ts                      # NEW (Phase 5): hot→archive monthly
    ├── audit-purge.ts                        # NEW (Phase 5): retention purge nightly
    └── audit-export.ts                       # NEW (Phase 4): CSV + signed bundle
eslint-rules/
└── require-audit-log.js                      # NEW: lint rule for mutating actions
prisma/
└── schema.prisma                             # MODIFY: add AuditLogArchive, LegalHold
```

---

## Phase 1: Helper + redaction + comprehensive instrumentation

**Goal:** Every mutating server action and API route writes a typed `AuditLog` row. Redaction prevents secrets leaking. eslint catches new actions that forget.

- [ ] **Step 1: Create `src/lib/audit-actions.ts`** with the canonical verb vocabulary:
  ```ts
  export const AUDIT_VERBS = [
    "create", "update", "delete",
    "approve", "reject", "publish", "archive",
    "assign", "unassign", "complete", "verify",
    "invite", "accept", "revoke",
    "export", "import",
    "impersonate.start", "impersonate.end",
    "feature-gate.deny",
    "legal-hold.place", "legal-hold.lift",
  ] as const;
  export type AuditVerb = (typeof AUDIT_VERBS)[number];
  ```
  Action format: `{verb}.{EntityType}`. Examples: `update.User`, `create.Vote`, `assign.MaintenanceTicket`, `feature-gate.deny`.

- [ ] **Step 2: Create `src/lib/audit-redaction.ts`** with a per-model whitelist:
  ```ts
  const REDACTORS: Record<string, (i: unknown) => Record<string, unknown>> = {
    User: (u: any) => pick(u, ["email", "name", "language", "isActive"]),
    Vote: (v: any) => pick(v, ["title", "description", "deadline", "majorityType", "status"]),
    LedgerEntry: (l: any) => pick(l, ["amount", "currency", "debitAccountId", "creditAccountId", "description", "postedAt"]),
    // ... one per audited model
  };
  export function serializeForAudit(entityType: string, instance: unknown): Record<string, unknown> {
    const fn = REDACTORS[entityType];
    if (!fn) throw new Error(`No audit serializer for ${entityType}`);
    return fn(instance);
  }
  ```
  Anything not whitelisted is dropped. `passwordHash`, tokens, secrets — never appear in audit. The serializer is **per-model code**, not a config blob, so changes go through code review.

- [ ] **Step 3: Create `src/lib/audit.ts`**:
  ```ts
  export async function audit(args: {
    entityType: string;
    entityId: string;
    action: string;       // verb.EntityType, validated against the action const
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
  }): Promise<void> {
    const session = await auth();
    if (!session?.user) throw new Error("audit() called outside session");
    await prisma.auditLog.create({
      data: {
        entityType: args.entityType,
        entityId: args.entityId,
        action: args.action,
        userId: session.user.id,
        oldValue: args.oldValue ? serializeForAudit(args.entityType, args.oldValue) : null,
        newValue: args.newValue ? serializeForAudit(args.entityType, args.newValue) : null,
        reason: args.reason ?? null,
      },
    });
  }
  ```

- [ ] **Step 4: Wire every mutating server action**. Sweep through `src/app/[locale]/**/actions.ts` and `src/app/api/**/route.ts`. After every write (create / update / delete), call `audit(...)`. ~40-60 callsites expected. Track in a checklist; one PR per module is fine.

- [ ] **Step 5: eslint rule** `eslint-rules/require-audit-log.js`. Detects functions exported with `"use server"` directive, or files under `app/api/`, that perform `prisma.<model>.{create,update,delete,upsert}` without a corresponding `audit(...)` call in the same scope. Fails CI; documented exceptions via `// eslint-disable-next-line audit/required` with a reason comment.

- [ ] **Step 6: Migrate the existing rare audit calls** to the new helper (if any exist). `grep -r "auditLog.create" src/` to find them.

- [ ] **Step 7: Commit**
  ```bash
  git commit -m "feat(audit): phase 1 — helper, redaction, comprehensive instrumentation, lint rule"
  ```

---

## Phase 2: Admin audit page

**Goal:** A page at `/admin/audit` that ADMIN, SUPER_ADMIN, and AUDITOR can use to investigate.

- [ ] **Step 1: Search route** at `src/app/api/audit/search/route.ts`. Accepts query params:
  - `from`, `to` (date range; default = last 30 days)
  - `userId` (filter by actor)
  - `entityType`, `entityId`
  - `action` (verb prefix match)
  - `q` (free-text search on `reason` and `entityId`)
  - `cursor` for keyset pagination
  Returns 50 rows per page. RBAC: requires `AUDITOR` capability OR ADMIN/SUPER_ADMIN. Per-building scope: AUDITOR only sees their building(s); ADMIN sees their subscription's buildings; SUPER_ADMIN sees all.

- [ ] **Step 2: Page layout** at `src/app/[locale]/admin/audit/page.tsx`. Filter strip at top (date pickers, dropdowns, search input). Table below with columns: Timestamp · Actor (avatar + name) · Action · Entity (link to detail) · Short diff (3 most-changed fields). Click row to expand: side-by-side diff of `oldValue` and `newValue` with field-level highlight.

- [ ] **Step 3: Saved filter sets**. New `AuditSavedFilter` table:
  ```prisma
  model AuditSavedFilter {
    id         String   @id @default(cuid())
    user       User     @relation(fields: [userId], references: [id])
    userId     String
    name       String
    filterJson Json
    isShared   Boolean  @default(false)
    createdAt  DateTime @default(now())
    @@index([userId])
  }
  ```
  Lets users bookmark e.g. "Recent finance changes" or "All board-member edits last quarter". `isShared = true` makes it visible to other ADMINs in the same building.

- [ ] **Step 4: Performance**. Confirm the existing `@@index([entityType, entityId])`, `@@index([userId])`, `@@index([createdAt])` are sufficient for the typical filter combinations. Add a composite `@@index([createdAt, entityType])` for date+type-prefixed scans.

- [ ] **Step 5: Migration + commit**
  ```bash
  npx prisma migrate dev --name phase2-audit-saved-filters
  git commit -m "feat(audit): phase 2 — admin audit page with filters and saved sets"
  ```

---

## Phase 3: User "my activity" page

**Goal:** GDPR Art. 15 access right. Every authenticated user sees actions where `userId = me` OR `entityId` is a record they own (UnitUser, Unit, etc.).

- [ ] **Step 1: Page** at `src/app/[locale]/settings/activity/page.tsx`. Two tabs:
  - **Saját műveleteim** (My actions) — actions where I am the actor.
  - **Engem érintő** (Affecting me) — actions on my User row, my UnitUser memberships, my owned Units, my Ballots, my Notifications.

- [ ] **Step 2: Personal-data export endpoint** at `src/app/api/me/export/route.ts`. Returns a ZIP of all data about the user: their profile, audit rows, owned units, ballots cast. GDPR Art. 15 satisfies. Streamed to avoid memory blowup.

- [ ] **Step 3: Rate-limit the export**. Same user can request once per 24 hours; subsequent requests reuse the prior bundle if recent.

- [ ] **Step 4: Commit**
  ```bash
  git commit -m "feat(audit): phase 3 — user activity view + GDPR Art. 15 export"
  ```

---

## Phase 4: Export (CSV + signed bundle) + worker job

**Goal:** Large date-range exports run async; jobId polling; signed bundle includes a HMAC manifest for verifiable provenance.

- [ ] **Step 1: Export trigger route** at `src/app/api/audit/export/route.ts`. Accepts the same filter parameters as the search route. RBAC: ADMIN / SUPER_ADMIN / AUDITOR. Rejects if estimated row count > 500 000 (returns "narrow your filters"). Enqueues a BullMQ job, returns `{ jobId }`.

- [ ] **Step 2: Worker job** at `worker/jobs/audit-export.ts`:
  - Stream rows from `prisma.auditLog.findMany(...)` with cursor pagination.
  - Write CSV rows to a temp file (or directly to R2 multipart upload — cross-ref file-storage plan).
  - Build `manifest.json` with: filter params, total row count, timestamp, exporter userId, SHA-256 of the CSV, HMAC of (CSV-SHA + timestamp + exporter) using a server secret.
  - ZIP both files.
  - Upload to R2 under `b/{buildingId}/audit-exports/{jobId}.zip`.
  - Set `retainUntil = now + 30 days` so the bundle auto-purges.

- [ ] **Step 3: Download route** at `src/app/api/audit/export/[id]/download/route.ts`. Validates the caller is the original exporter or an ADMIN. Returns a signed GET URL (cross-ref file-storage plan).

- [ ] **Step 4: Job status route** for client polling, or stream via SSE (cross-ref real-time plan).

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(audit): phase 4 — async CSV export with HMAC-signed manifest"
  ```

---

## Phase 5: Retention + legal hold + partitioning

**Goal:** Per-entity retention rules. `LegalHold` flag suspends purge. Monthly archive partition keeps the hot table fast.

- [ ] **Step 1: Schema additions**:
  ```prisma
  model AuditLogArchive {
    id         String   @id            // same id as the original
    entityType String
    entityId   String
    action     String
    userId     String
    oldValue   Json?
    newValue   Json?
    reason     String?
    createdAt  DateTime
    archivedAt DateTime @default(now())
    @@index([entityType, entityId])
    @@index([userId])
    @@index([createdAt])
  }

  model LegalHold {
    id           String   @id @default(cuid())
    entityType   String
    entityId     String?  // null = building-wide hold for that entityType
    building     Building @relation(fields: [buildingId], references: [id])
    buildingId   String
    reason       String   // case number, court order, etc.
    placedById   String
    placedBy     User     @relation("LegalHoldPlaced", fields: [placedById], references: [id])
    placedAt     DateTime @default(now())
    liftedById   String?
    liftedBy     User?    @relation("LegalHoldLifted", fields: [liftedById], references: [id])
    liftedAt     DateTime?
    @@index([buildingId, entityType])
  }
  ```

- [ ] **Step 2: Retention rules** in `src/lib/audit-retention.ts`:
  ```ts
  export const RETENTION_DAYS: Record<string, number | "forever"> = {
    // Accounting (Számviteli tv. § 169)
    "LedgerEntry": 8 * 365, "MonthlyCharge": 8 * 365, "Budget": 8 * 365,
    "BankTransaction": 8 * 365, "BankImport": 8 * 365,
    // Governance (Tht. § 44 — life of the condominium)
    "Vote": "forever", "Ballot": "forever", "Meeting": "forever",
    "AuditorMembership": "forever", "UserBuilding": "forever",
    // General business records (Ptk. statute of limitations)
    "MaintenanceTicket": 6 * 365, "Document": 6 * 365, "Announcement": 6 * 365,
    // Default
    "*": 6 * 365,
  };
  ```

- [ ] **Step 3: Archive worker** `worker/jobs/audit-archive.ts`. Daily. Moves rows older than 90 days from `AuditLog` to `AuditLogArchive` (insert + delete in a transaction). Keeps hot queries fast.

- [ ] **Step 4: Purge worker** `worker/jobs/audit-purge.ts`. Daily. For each row in `AuditLogArchive`:
  - Look up retention for `entityType`. If `forever`, skip.
  - If `archivedAt + retentionDays < now`, candidate for purge.
  - Check `LegalHold` table — if any active hold matches `(entityType, entityId)` or `(entityType, null)` for this building, skip.
  - Else, delete.

- [ ] **Step 5: Place / lift legal hold endpoints** at `src/app/api/legal-holds/route.ts`. RBAC: ADMIN / SUPER_ADMIN. Every place and lift writes its own `AuditLog` row (`legal-hold.place.LegalHold`, `legal-hold.lift.LegalHold`).

- [ ] **Step 6: Search routes also query the archive** when filter `to` is older than 90 days — UNION of `AuditLog` and `AuditLogArchive`.

- [ ] **Step 7: Migration + commit**
  ```bash
  npx prisma migrate dev --name phase5-audit-archive-and-legal-hold
  git commit -m "feat(audit): phase 5 — retention rules + legal hold + monthly archive (Tht. § 44, Számviteli tv. § 169)"
  ```

---

## Cross-references

- **Vendor anonymization** (legal-alignment plan, Phase 5b): vendor-facing audit views must use `serializeForAudit` versions that strip resident PII.
- **Impersonation** (legal-alignment plan, out of scope until policy lands): when implemented, MUST emit `impersonate.start.User` and `impersonate.end.User` audit entries with a 7-year `LegalHold` set automatically. Note this here as the integration point.
- **Camera access** (legal-alignment plan, Phase 5c): every `BuildingCamera` access already produces a `CameraAccessLog`; mirror it as `read.BuildingCamera` audit row so the admin audit page surfaces it.

---

## Out of scope (tracked for follow-up)

- **Tamper-evident chain** (Merkle / append-only ledger).
- **Real PKI on exports** (NetLock or similar HU CA) — separate plan; the HMAC manifest here is sufficient for non-court-admissible internal use.
- **Cross-tenant queries for SUPER_ADMIN GDPR investigations** — exists implicitly via the page's RBAC but no special UI.
- **Ingestion of external system audits** (Stripe, Resend, Cloudflare).
- **Anomaly detection** on audit patterns.

---

## Acceptance criteria

This plan is complete when:

1. Every mutating server action produces exactly one `AuditLog` row (verified by integration test sweep).
2. `passwordHash` never appears in any AuditLog `oldValue` or `newValue` (regex grep over a year of audit data returns 0 hits).
3. AUDITOR role can read `/admin/audit` but cannot mutate (POST attempts return 403).
4. An OWNER on `/settings/activity` sees only their own actions and actions on their own UnitUser/Unit rows.
5. Exporting 50 000 rows produces a CSV bundle in **< 30 s** in the worker.
6. The exported bundle's HMAC verifies against the server secret and the rebuilt CSV-SHA — flips to invalid if a single byte changes.
7. A row protected by `LegalHold` is not purged even after retention expiry.
8. Lifting a legal hold creates its own audit entry.
9. The eslint rule fails CI for a new mutating action that doesn't call `audit()`.
10. Querying for a date range > 90 days transparently UNIONs `AuditLog` + `AuditLogArchive`.

When all ten hold, the audit log is a working compliance surface, not just a dormant table.
