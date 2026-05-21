# File Storage Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up cloud file storage for every upload-bearing module — documents (with versioning), ticket photos, invoice receipts, contractor DPAs, camera footage, profile avatars. Today the schema has plain `String fileUrl` columns pointing nowhere; no client, no upload handler, no signed URLs, no retention policy.

**Architecture:** Cloudflare R2 (S3-compatible) as primary storage in EU region. All uploads use signed PUT URLs (browser → R2 directly); all downloads go through a Next.js route handler that validates session + RBAC + entity ownership before issuing a signed GET. Five phases, each a separate commit, app remains functional throughout.

**Tech Stack:** Prisma, PostgreSQL, Next.js 15, BullMQ worker on Redis, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp` for thumbnails, ClamAV for virus scanning.

**Spec source:** Audit findings dated 2026-04-28 (`docs/plans/2026-04-27-roles-legal-alignment.md` references for retention rules and DPA handling).

**Non-goals:**
- Building a full DAM (digital asset management) UI.
- Migrating any historical data — none exists.
- CDN tuning beyond R2 defaults.
- Replacing nodemailer attachments with R2-hosted links (separate consideration).
- Per-page bandwidth metering UI.

---

## File Structure — What Changes

```
src/
├── lib/
│   ├── storage.ts                           # NEW: getUploadUrl, getDownloadUrl, helpers
│   ├── storage-keys.ts                      # NEW: key-format and category enum
│   └── virus-scan.ts                        # NEW (Phase 4): ClamAV client
├── app/
│   └── api/
│       └── storage/
│           ├── upload-url/route.ts          # NEW: POST signed-PUT URL issuance
│           └── download-url/[id]/route.ts   # NEW: GET signed-GET URL with RBAC
worker/
├── jobs/
│   ├── thumbnail.ts                         # NEW (Phase 4): sharp resize on upload
│   ├── virus-scan.ts                        # NEW (Phase 4): ClamAV scan, quarantine handling
│   └── camera-retention.ts                  # NEW (Phase 5): 15-day rolloff for cameras/
infra/
└── r2-lifecycle.tf                          # NEW (Phase 5): bucket lifecycle rules as IaC
.env.example                                 # MODIFY: R2 credentials and bucket name
```

No Prisma schema changes — existing `String fileUrl` / `String storageKey` columns are reused; the key format moves into the helper.

---

## Legal Anchors

| Concern | Source | Retention |
|---|---|---|
| Camera footage | Tht. § 25 + NAIH | **Max 15 days** |
| Accounting receipts (LedgerEntry.receiptUrl) | Számviteli tv. § 169 | **8 years** |
| Resolution Book / minutes (jegyzőkönyv PDFs) | Tht. § 44 | **Life of the condominium** |
| Contractor DPA | GDPR Art. 28 + business retention | While contract active + GDPR window |
| Profile avatars | GDPR | 30 days after user deletion |

Retention is enforced at two layers: bucket lifecycle rules (R2-side, eventual) and an app-level cleanup worker (faster, defensive).

---

## Phase 1: R2 client + signed-URL helpers + first upload (profile avatar)

**Goal:** Smallest possible end-to-end. Adds the SDK, env vars, the helper, and one canary upload (profile avatar) so we can verify the full path before wiring complex modules.

- [ ] **Step 1: Provision R2 bucket** in Cloudflare dashboard. Names: `kozos-prod`, `kozos-staging`, `kozos-dev`. EU jurisdiction (Frankfurt or Amsterdam). CORS allow `Origin: <app-origin>` for `PUT` and `GET`.

- [ ] **Step 2: Add deps**
  ```bash
  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  ```

- [ ] **Step 3: Add env vars** to `.env.example` and `.env.local`:
  ```
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET=kozos-dev
  R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
  ```

- [ ] **Step 4: Create `src/lib/storage-keys.ts`** with the key-format contract:
  ```ts
  export type StorageCategory =
    | "documents" | "tickets" | "receipts" | "contracts" | "cameras" | "profile";
  export function buildKey(buildingId: string, category: StorageCategory, entityId: string, filename: string): string {
    return `b/${buildingId}/${category}/${entityId}/${filename}`;
  }
  ```

- [ ] **Step 5: Create `src/lib/storage.ts`**: S3 client init, `getUploadUrl(key, contentType, size)` returning a signed PUT URL (TTL 5 min) with content-type and content-length-range constraints; `getDownloadUrl(key)` returning a signed GET URL (TTL 15 min). Reject keys not matching the `b/{buildingId}/...` prefix to prevent path traversal.

- [ ] **Step 6: MIME type allowlist** (server-side enforcement before signing):
  ```ts
  export const ALLOWED_MIME = new Set([
    "application/pdf", "image/png", "image/jpeg", "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  ```
  Reject everything else with 415.

- [ ] **Step 7: Profile avatar canary**: a small endpoint at `src/app/api/profile/avatar/upload-url/route.ts` that calls `getUploadUrl` for category `profile`, validates session, returns the URL + final key. Simple `<AvatarUpload>` component on `/settings`.

- [ ] **Step 8: Run migration / commit**
  ```bash
  git commit -m "feat(storage): phase 1 — R2 client, signed-URL helpers, profile avatar canary"
  ```

---

## Phase 2: Document upload + visibility-gated download

**Goal:** Wire `Document` and `DocumentVersion` to R2. Visibility enforcement (`DocumentVisibility` enum: `PUBLIC | BOARD_ONLY | ADMIN_ONLY`) lives in the download route — that's the choke point.

- [ ] **Step 1: Document upload route** at `src/app/api/documents/upload-url/route.ts`. Validates that the caller has `document.publish.public` or `document.publish.boardOnly` capability per the legal-alignment plan's `can()` map. Returns signed PUT URL for `b/{buildingId}/documents/{documentId}/{filename}`.

- [ ] **Step 2: On upload-complete callback** (POST from client after PUT succeeds), create `DocumentVersion` row with `fileUrl` = the canonical key. Increment `versionNumber`. Mark prior versions as non-current.

- [ ] **Step 3: Document download route** at `src/app/api/documents/[id]/download-url/route.ts`. Loads the document, checks visibility against caller's role:
  - `PUBLIC` → any building member
  - `BOARD_ONLY` → BOARD_MEMBER, ADMIN, AUDITOR
  - `ADMIN_ONLY` → ADMIN, SUPER_ADMIN
  Returns signed GET URL (TTL 15 min). Logs the access in `AuditLog` (cross-ref audit-ui plan).

- [ ] **Step 4: Restore an old version**: action that creates a new `DocumentVersion` row pointing at the older object key, marked current. The bucket holds immutable bytes.

- [ ] **Step 5: Tests + commit**
  ```bash
  git commit -m "feat(storage): phase 2 — document upload + visibility-gated download"
  ```

---

## Phase 3: Ticket attachments + ledger receipts

**Goal:** Extend the helper for `TicketAttachment` and `LedgerEntry.receiptUrl`. Add vendor-anonymized download for ticket attachments routed to external contractors (cross-ref legal-alignment plan vendor anonymizer).

- [ ] **Step 1: Ticket attachment upload route** at `src/app/api/maintenance/tickets/[id]/attachments/upload-url/route.ts`. Caller must be the reporter, an assignee, or have `ticket.assign` capability.

- [ ] **Step 2: Ticket attachment download route**. Two paths:
  - Internal viewer (resident, board, admin): full filename + metadata.
  - **Vendor viewer** (contractor with active assignment): anonymized — strip resident name from filename, expose only "kép-{n}.jpg" or "számla-{n}.pdf". Bound to `Contractor.dataProcessingAgreementDocumentId` being set (legal-alignment plan).

- [ ] **Step 3: LedgerEntry receipt upload**. Endpoint at `src/app/api/finance/ledger/[id]/receipt/upload-url/route.ts`. Restricted to BOARD_MEMBER + chair / ADMIN. Receipt key under `receipts/{ledgerEntryId}/`.

- [ ] **Step 4: LedgerEntry receipt download**. Visibility: BOARD_MEMBER, ADMIN, AUDITOR (read-only).

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(storage): phase 3 — ticket attachments + ledger receipts with vendor anonymization"
  ```

---

## Phase 4: Virus scanning + image thumbnails

**Goal:** Every upload runs through ClamAV before being usable; ticket photos and avatars get thumbnails generated automatically.

- [ ] **Step 1: ClamAV sidecar**. Add a `clamav` service to `docker-compose.yml` exposing port 3310 internally (clamd protocol). The worker container has network access.

- [ ] **Step 2: Quarantine prefix**. New uploads go to `b/{buildingId}/{category}/{entityId}/.quarantine/{filename}` first. Helper change: `getUploadUrl` accepts a `quarantine: boolean` flag.

- [ ] **Step 3: Scan worker** at `worker/jobs/virus-scan.ts`. Triggered by an upload-complete callback. Streams the object from R2 to clamd via `clamscan` npm package. On clean: server-side copy from quarantine to canonical key, delete quarantine. On infected: delete quarantine, audit-log the incident, notify admin.

- [ ] **Step 4: Thumbnail worker** at `worker/jobs/thumbnail.ts`. For images (PNG/JPEG/WebP), use `sharp` to generate a 640×480 JPEG at quality 80 next to the original (`{filename}.thumb.jpg`). For tickets and profile avatars only — documents and receipts skip.

- [ ] **Step 5: Add `sharp` and `clamscan` deps**. Document the docker-compose addition.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(storage): phase 4 — virus scanning + image thumbnails"
  ```

---

## Phase 5: Retention policies + legal hold

**Goal:** Encode the retention rules as both R2 lifecycle config and app-level cleanup. Add a `legalHold` flag on `Document` to suspend deletion during litigation.

- [ ] **Step 1: R2 lifecycle config**. Author `infra/r2-lifecycle.tf` (Terraform; or a JSON config applied via Wrangler):
  - Prefix `b/*/cameras/` → delete after 15 days.
  - Prefix `b/*/profile/` → delete after 30 days from a `deleted_at` tag (set when the user is deleted; lifecycle reads the tag).
  - Quarantine prefix `*/.quarantine/` → delete after 24 hours.
  - All other prefixes: no auto-delete; cleanup is app-driven.

- [ ] **Step 2: Camera retention worker** at `worker/jobs/camera-retention.ts`. Daily cron. Lists `BuildingCamera` records (legal-alignment plan), enumerates objects under `cameras/{cameraId}/` with `LastModified < now - 15 days`, deletes them. Adds a CameraAccessLog "purge" entry.

- [ ] **Step 3: Legal-hold flag**. Add to `Document` model:
  ```prisma
  model Document {
    // ...existing...
    legalHold              Boolean   @default(false)
    legalHoldReason        String?
    legalHoldPlacedAt      DateTime?
  }
  ```
  When `legalHold = true`, neither the lifecycle rules nor the cleanup workers may delete the object. Placing/lifting a hold writes to `AuditLog` and (later) `LegalHold` table from the audit-ui plan.

- [ ] **Step 4: Cleanup worker for orphans**. Daily job: list R2 keys, find any with no matching `Document/DocumentVersion/TicketAttachment/LedgerEntry/etc.` row, delete after 7 days of orphan-state. Avoids storage cost for failed-upload artifacts.

- [ ] **Step 5: Migration + commit**
  ```bash
  npx prisma migrate dev --name phase5-document-legal-hold
  git commit -m "feat(storage): phase 5 — retention policies + legal hold (Tht. § 25, Számviteli tv. § 169, Tht. § 44)"
  ```

---

## Cost-protection note (cross-ref feature-gating plan)

Per-building monthly upload quota is enforced by the feature-gating layer:
- Kezdő: 1 GB / building / month
- Képviselő: 10 GB / building / month
- Kezelő iroda: unlimited (fair-use)

This plan exposes a `getStorageUsage(buildingId, periodStart, periodEnd)` helper that the feature-gating layer calls. Quota exceeded → upload route returns 402 with an upgrade prompt.

---

## Out of scope (tracked for follow-up)

- **Real PKI signatures on stored documents** (qualified e-signature). Separate plan.
- **WebDAV / desktop sync** (Mac Finder integration etc.). Not requested.
- **Bulk download / ZIP export of a building's documents** (large-scale archive). Future plan if customers ask.
- **Cross-region replication.** R2 EU is enough for now; add only when first customer with sub-EU requirement appears.
- **CDN-level transforms** (Cloudflare Images). Defer; `sharp` worker is enough.

---

## Acceptance criteria

This plan is complete when:

1. Uploading a 5 MB document round-trips in **< 8 s** on a typical link (PUT signed URL, then upload-complete callback).
2. A user without permission for a `BOARD_ONLY` document gets HTTP **403** from the download-url route.
3. A user without an active `Contractor.dataProcessingAgreementDocumentId` cannot fetch a ticket attachment download URL.
4. Camera footage objects with `LastModified` older than 15 days are deleted by the lifecycle rule (verified by listing the bucket on day 16).
5. A virus-detected upload is moved to `quarantine/`, deleted within 24 h, and produces an audit-log entry.
6. A thumbnail of a ticket photo appears in the maintenance UI within **30 s** of upload.
7. Setting `legalHold = true` on a Document prevents both lifecycle rules and cleanup workers from deleting its object.
8. An orphan key (no DB row referencing it) is deleted by the orphan-cleanup worker within 7 days.
9. Per-building monthly upload over the plan quota returns 402 from the upload-url route.
10. All keys in the bucket match `b/{cuid}/{category}/{entityId}/...` — no path-traversal regressions, validated by a daily lint job over the bucket inventory.

When all ten hold, file storage is production-ready.
