# Banking Integrations Implementation Plan (Research-Heavy)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a phased path from "no bank integration" → "manual CSV upload with smart reconciliation" → "scheduled MT940/CAMT.053 statement import" → "PSD2 AISP via aggregator" so the marketing claim **"élő bankszinkron"** is eventually truthful. Phase 1 ships something usable in 2-3 weeks; later phases are research and pilots.

**Architecture:** Five phases, each a separate commit. Phase 1 introduces the schema and a generic CSV parser with column-mapping UI. Phase 2 adds bank-specific parsers (OTP, K&H, Erste, Raiffeisen). Phase 3 builds the reconciliation engine. Phase 4 adds standardized statement formats (MT940 / CAMT.053). Phase 5 pilots a PSD2 aggregator. Implementation **deliberately starts with file imports** because Hungarian PSD2 retail-bank coverage is patchy as of 2026-04 — we cannot promise a one-click sync without a sustained aggregator partnership.

**Tech Stack:** Next.js 15, Prisma, BullMQ on Redis, `xlsx` already a dep. New deps: `csv-parse` (Phase 1), `mt940` (Phase 4), `xml2js` for CAMT.053 (Phase 4). Aggregator SDK in Phase 5 (Salt Edge or Tink).

**Spec source:** Audit findings dated 2026-04-28; cross-references the existing `docs/plans/2026-03-26-condo-manager-finance.md`. The agent that drafts this plan should run a fresh WebSearch pass to confirm bank PSD2 status — coverage changes quarterly.

**Non-goals:**
- Becoming a licensed AISP ourselves. Use an aggregator for PSD2.
- Outgoing payments / SEPA transfers initiated by the SaaS (different licence).
- Multi-currency support — HUF only.
- Real-time push notifications on each transaction (cross-ref real-time plan; not part of this plan).
- Tax reporting integration (NAV / KÖVTAN — separate).

---

## Hungarian banking landscape — research notes (verify before starting)

The drafting agent **should run WebSearch on each item below** and update this section with current state.

| Bank | CSV from netbank | MT940 | CAMT.053 | PSD2 AISP via aggregator | Notes |
|---|---|---|---|---|---|
| **OTP** | Yes (proprietary, `;`-separated, ISO-8859-2) | Yes (corporate) | Yes (corporate) | TBD | Largest HU retail bank |
| **K&H** | Yes (proprietary CSV) | Yes (corporate) | Yes | TBD | KBC group |
| **Erste** | Yes | Yes (corporate) | Yes | TBD via Tink (parent: Visa) | |
| **Raiffeisen** | Yes | Yes | Yes | TBD | |
| **MKB / Mbank** | Yes (rebranded 2024) | Yes | Yes | TBD | |
| **UniCredit** | Yes | Yes | Yes | TBD | |
| **CIB** | Yes | Yes | Yes | TBD | Intesa Sanpaolo group |
| **Magnet** | Yes | TBD | TBD | TBD | Smaller bank |
| **Gránit** | Yes | TBD | TBD | TBD | Digital-first |

**Aggregator coverage (HU)**, as of 2026-04 — verify pricing per connection per month:
- **Salt Edge**: covers most HU retail banks per their 2024 expansion
- **Tink** (Visa-owned): broad EU coverage; HU coverage TBD
- **GoCardless / Nordigen Bank Account Data**: EU PSD2 wrapper — verify HU
- **Plaid**: limited HU presence

**MNB notes**: Hungarian National Bank's PSD2 enforcement — confirm any local quirks (e.g. SCA requirements, consent renewal periods).

---

## File Structure — What Changes

```
src/
├── lib/
│   └── bank/
│       ├── parsers/
│       │   ├── generic.ts              # NEW (Phase 1)
│       │   ├── otp.ts                  # NEW (Phase 2)
│       │   ├── kh.ts                   # NEW (Phase 2)
│       │   ├── erste.ts                # NEW (Phase 2)
│       │   ├── raiffeisen.ts           # NEW (Phase 2)
│       │   ├── mt940.ts                # NEW (Phase 4)
│       │   └── camt053.ts              # NEW (Phase 4)
│       ├── reconciliation.ts           # NEW (Phase 3)
│       ├── duplicate-detector.ts       # NEW (Phase 1)
│       └── reference-parser.ts         # NEW (Phase 3): "B/2.3 közös költség" → unitId
├── app/
│   ├── [locale]/finance/bank/
│   │   ├── page.tsx                    # NEW: bank account list + upload
│   │   └── [accountId]/
│   │       ├── page.tsx                # NEW: transactions table
│   │       └── unmatched/page.tsx      # NEW (Phase 3): review queue
│   └── api/bank/
│       ├── import/route.ts             # NEW (Phase 1): CSV upload
│       ├── transactions/[id]/match/route.ts  # NEW (Phase 3): manual match
│       └── aggregator/webhook/route.ts # NEW (Phase 5): PSD2 events
worker/
└── jobs/
    └── bank-aggregator-sync.ts         # NEW (Phase 5): cron + webhook handler
prisma/
└── schema.prisma                       # MODIFY: BankAccount, BankImport, BankTransaction
```

---

## Phase 1: Schema + manual CSV upload (generic format)

**Goal:** End-to-end upload → parse → store → manual link to charges. Generic CSV parser with a column-mapping UI works for any bank.

- [ ] **Step 1: Add deps**
  ```bash
  npm install csv-parse iconv-lite
  ```
  `iconv-lite` for ISO-8859-2 (some HU banks export Latin-2 encoded files).

- [ ] **Step 2: Schema additions**:
  ```prisma
  model BankAccount {
    id              String   @id @default(cuid())
    building        Building @relation(fields: [buildingId], references: [id])
    buildingId      String
    bankName        String   // "OTP Bank", "K&H", etc.
    accountNumber   String   // 24-digit IBAN or 16-digit local
    accountAlias    String?  // "Folyószámla" / "Tartalékalap"
    ledgerAccount   Account  @relation(fields: [ledgerAccountId], references: [id])
    ledgerAccountId String   // chart-of-accounts FK
    currency        String   @default("HUF")
    isActive        Boolean  @default(true)
    createdAt       DateTime @default(now())
    imports         BankImport[]
    transactions   BankTransaction[]
    @@index([buildingId])
  }

  model BankImport {
    id              String      @id @default(cuid())
    bankAccount     BankAccount @relation(fields: [bankAccountId], references: [id])
    bankAccountId   String
    fileFormat      String      // "csv-generic" | "csv-otp" | "csv-kh" | "mt940" | "camt053"
    fileHash        String      // SHA-256 of uploaded file
    importedById    String
    importedBy      User        @relation(fields: [importedById], references: [id])
    totalRows       Int
    matchedRows     Int         @default(0)
    duplicateRows   Int         @default(0)
    failedRows      Int         @default(0)
    importedAt      DateTime    @default(now())
    notes           String?
    transactions   BankTransaction[]
    @@unique([bankAccountId, fileHash])
  }

  model BankTransaction {
    id              String   @id @default(cuid())
    bankAccount     BankAccount @relation(fields: [bankAccountId], references: [id])
    bankAccountId   String
    import          BankImport? @relation(fields: [importId], references: [id])
    importId        String?
    postedAt        DateTime
    valueDate       DateTime?
    amount          Decimal  @db.Decimal(14, 2)
    currency        String   @default("HUF")
    counterparty    String?
    counterpartyIban String?
    reference       String?  // közlemény
    rawDescription  String?
    matchedChargeId String?
    matchedCharge   MonthlyCharge? @relation(fields: [matchedChargeId], references: [id])
    ledgerEntryId   String?
    ledgerEntry     LedgerEntry?   @relation(fields: [ledgerEntryId], references: [id])
    status          String   // "matched" | "unmatched" | "manual" | "ignored"
    matchScore      Float?   // 0..1 confidence from reconciliation engine
    createdAt       DateTime @default(now())
    @@index([bankAccountId, postedAt])
    @@index([status])
  }
  ```

- [ ] **Step 3: Generic CSV parser** at `src/lib/bank/parsers/generic.ts`:
  - Accept a `ColumnMapping` object: `{ date: 0, amount: 2, counterparty: 3, reference: 4, ... }`.
  - Stream-parse with `csv-parse`; `iconv-lite` decodes ISO-8859-2 if the file's Content-Type or detected encoding requires.
  - Yield rows as typed `ParsedTransaction { postedAt, amount, counterparty, reference, rawDescription }`.

- [ ] **Step 4: Duplicate detection** at `src/lib/bank/duplicate-detector.ts`:
  - Hash `(postedAt | amount | counterparty | reference)` per row → `transactionFingerprint`.
  - Per-account uniqueness on import: skip rows whose fingerprint already exists for this `bankAccountId`.
  - Bonus: also dedupe within the same file (some bank exports duplicate header/footer rows).

- [ ] **Step 5: Upload route** at `src/app/api/bank/import/route.ts`:
  - Accept multipart upload + `bankAccountId` + `format = generic` + `columnMapping` JSON.
  - Compute file SHA-256; reject if `(bankAccountId, fileHash)` already exists.
  - Run parser, upsert `BankTransaction` rows with `status = unmatched`, count results, persist `BankImport` row.
  - Feature gate: requires `finance.bank-csv` (cross-ref feature-gating plan).

- [ ] **Step 6: UI**. `/finance/bank` lists accounts and a "Új importálás" button. The wizard: pick account → upload file → choose pre-built bank template (Phase 2) OR map columns manually → preview first 5 rows → confirm.

- [ ] **Step 7: Migration + commit**
  ```bash
  npx prisma migrate dev --name phase1-bank-accounts-and-imports
  git commit -m "feat(bank): phase 1 — schema + generic CSV upload + duplicate detection"
  ```

---

## Phase 2: Bank-specific CSV templates

**Goal:** Pre-built parsers for the four largest HU retail banks. Users pick their bank from a dropdown; no manual column mapping needed.

- [ ] **Step 1: OTP CSV parser** at `src/lib/bank/parsers/otp.ts`. Document the format in a comment block:
  ```
  OTP Bank CSV (as of 2026-04-28):
    Encoding: ISO-8859-2
    Separator: ;
    Header: "Tranzakció dátuma";"Értéknap";"Összeg";"Pénznem";"Partner név";"Partner számlaszám";"Közlemény";...
    Quotes: double quotes around all string fields
    Decimal: comma as decimal separator
  ```
  Implement as a wrapper over `generic.ts` with the column mapping baked in.

- [ ] **Step 2: K&H CSV parser**. Document format. K&H typically exports UTF-8, comma-separated, English column headers in Hungarian sub-mode.

- [ ] **Step 3: Erste CSV parser**.

- [ ] **Step 4: Raiffeisen CSV parser**.

- [ ] **Step 5: Bank dropdown in upload wizard**. When picked, the column-mapping step is skipped.

- [ ] **Step 6: Test fixtures**. Each bank parser has a `__tests__/fixtures/` with a 10-row sample CSV (sanitized — no real account numbers). Tests assert the parser maps fields correctly.

- [ ] **Step 7: Commit**
  ```bash
  git commit -m "feat(bank): phase 2 — OTP, K&H, Erste, Raiffeisen CSV parsers"
  ```

---

## Phase 3: Reconciliation engine

**Goal:** Auto-match `BankTransaction` rows to `MonthlyCharge` rows. Hungarian convention puts unit info in the közlemény, often as "B/2.3 közös költség" or "Lakás 12 - 2026/04".

- [ ] **Step 1: Reference parser** at `src/lib/bank/reference-parser.ts`. Patterns to try in order:
  - `B/(\d+)\.(\d+)` → staircase + door (e.g. "B/2.3" → looks for unit `B-2-3` or similar)
  - `Lakás (\d+)` → unit number
  - 4-digit unit code on a building schema
  - Year/month signal: `(20\d\d)[/-]?(0?\d|1[0-2])` → MonthlyCharge period
  Returns `{ unitId?, period? }` candidates per transaction.

- [ ] **Step 2: Reconciliation algorithm** at `src/lib/bank/reconciliation.ts`. Per `BankTransaction`:
  1. Use reference parser to derive candidate `(unitId, period)`.
  2. Look up `MonthlyCharge` rows matching `(unitId, period)` with `status IN (UNPAID, OVERDUE)`.
  3. Filter by amount tolerance: `|charge.amount - transaction.amount| <= 100 HUF` (rounding allowance).
  4. Filter by date window: `transaction.postedAt BETWEEN charge.dueDate - 5 days AND charge.dueDate + 30 days`.
  5. If exactly one match: link, mark `status = matched`, `matchScore = 1.0`.
  6. If multiple matches: pick the most recent unpaid charge for that unit; `matchScore = 0.7`.
  7. If zero matches: `status = unmatched`.

- [ ] **Step 3: On match → create LedgerEntry**. Debit the bank's chart-of-accounts ledger account; credit the unit's receivables account. Marks the `MonthlyCharge.status` as PAID.

- [ ] **Step 4: Unmatched review UI** at `/finance/bank/[accountId]/unmatched`. Table of unmatched transactions with: row data, autocomplete to assign a unit + period, "Allocate to ..." dropdown for non-charge ledger entries (e.g. utility provider invoice). Each manual match writes an `AuditLog` row.

- [ ] **Step 5: Bulk match**. Button "Auto-match" runs the engine over all `unmatched` rows of an account; review the results before committing (dry-run).

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(bank): phase 3 — reconciliation engine + unmatched review queue"
  ```

---

## Phase 4: MT940 / CAMT.053 import

**Goal:** Standardized formats. Useful for corporate accounts and as a unification layer for PSD2 (which often returns CAMT.053 anyway).

- [ ] **Step 1: MT940 parser**. Use the `mt940` npm package. Map MT940 transaction fields (`:61:`, `:86:`) to `ParsedTransaction`. Handle SWIFT-specific codes.

- [ ] **Step 2: CAMT.053 parser**. XML format (ISO 20022). Use `xml2js` or `fast-xml-parser`. Map `Stmt/Ntry` blocks to `ParsedTransaction`. Handle credit/debit indicator (`CdtDbtInd`).

- [ ] **Step 3: Add to upload wizard**. Format dropdown adds `MT940` and `CAMT.053`.

- [ ] **Step 4: Test fixtures**. Sample MT940 + CAMT.053 files (sanitized) under `__tests__/fixtures/`.

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(bank): phase 4 — MT940 + CAMT.053 statement parsers"
  ```

---

## Phase 5: PSD2 AISP pilot via aggregator

**Goal:** Pick one aggregator (Salt Edge or Tink — TBD by contract negotiations and HU coverage); integrate for 1-2 banks. Webhook receives new transactions, persists, runs reconciliation. After this phase, the marketing claim **"élő bankszinkron"** is finally truthful for the supported banks.

- [ ] **Step 1: Vendor selection**. Decision factors: HU coverage (number of supported banks), per-connection monthly cost, SCA reauth flow ergonomics, webhook reliability, sandbox quality. Document the chosen vendor in a runbook `docs/runbooks/bank-aggregator-vendor.md`.

- [ ] **Step 2: Schema additions**:
  ```prisma
  model BankAggregatorConnection {
    id                String   @id @default(cuid())
    bankAccount       BankAccount @relation(fields: [bankAccountId], references: [id])
    bankAccountId     String   @unique
    vendor            String   // "salt-edge" | "tink" | "gocardless"
    vendorAccountId   String   // their reference
    consentExpiresAt  DateTime
    status            String   // "pending" | "active" | "expired" | "error"
    lastSyncAt        DateTime?
    createdAt         DateTime @default(now())
    @@index([status, consentExpiresAt])
  }
  ```

- [ ] **Step 3: OAuth-style consent flow**. UI sends user to vendor's hosted consent page; on return, vendor calls our redirect URI with a code; we exchange for a `vendorAccountId`; persist as a `BankAggregatorConnection` with `status = active`.

- [ ] **Step 4: Webhook receiver** at `src/app/api/bank/aggregator/webhook/route.ts`. Vendor signs payloads — verify HMAC. Each "transaction.created" event: load matching `BankAccount`, normalise to `ParsedTransaction`, run reconciliation (Phase 3), persist as `BankTransaction` with `import.fileFormat = "aggregator"`.

- [ ] **Step 5: Periodic resync**. BullMQ cron `bank-aggregator-sync.ts` runs hourly: for active connections, polls vendor for any missed transactions in the last 7 days. Defensive in case of webhook delivery failures.

- [ ] **Step 6: Consent renewal**. PSD2 SCA consents typically last 90-180 days. UI surfaces a "renew consent" banner 14 days before expiry.

- [ ] **Step 7: Feature gate**. `finance.bank-sync-live` is the gating feature; only Kezelő iroda tier (cross-ref feature-gating plan).

- [ ] **Step 8: Commit**
  ```bash
  npx prisma migrate dev --name phase5-bank-aggregator-connection
  git commit -m "feat(bank): phase 5 — PSD2 AISP pilot via {vendor}"
  ```

---

## Out of scope (tracked for follow-up)

- **Becoming a licensed AISP ourselves** — uses an aggregator until volume justifies the licence cost.
- **Outgoing payments / SEPA transfers** initiated by the SaaS — different licence, different risk profile.
- **Multi-currency** — HUF only.
- **Real-time push notifications** on each transaction — separate plan; aggregator webhooks may piggyback.
- **Tax / NAV integration** — separate plan.
- **Card-on-file / Stripe-style billing for residents paying közös költség via card** — separate plan.

---

## Acceptance criteria

This plan is complete when:

1. Uploading the same CSV twice produces `duplicateRows = totalRows` and zero new transactions.
2. An OTP-formatted CSV with 100 transactions parses in **< 2 s** and **80%+ auto-match** to charges.
3. Unmatched transactions appear in a review queue and can be manually linked with one click.
4. Aggregator webhook delivers a new transaction to the DB within **60 s** of bank posting.
5. Every import is logged in `BankImport` with file hash and importer; reimports are blocked with `409 Conflict`.
6. A `BankAggregatorConnection` 14 days from consent expiry triggers a UI banner.
7. The reconciliation engine handles the four most common HU reference patterns: `B/2.3`, `Lakás 12`, `2026/04`, and bare unit codes.
8. Webhook signatures are HMAC-verified — bad signatures return 401.
9. Bank statement encoding is auto-detected (UTF-8 vs ISO-8859-2) on upload.
10. The `finance.bank-csv` feature gate blocks Kezdő-tier subscriptions from CSV upload (cross-ref feature-gating plan).

When all ten hold, the bank integration is production-ready and the marketing page can honestly say "élő bankszinkron" for the supported banks.
