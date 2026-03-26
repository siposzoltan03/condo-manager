# Condo Manager — Finance Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Finance module — double-entry ledger, unit charges, building budget, expense tracking, invoices.

**Architecture:** Extends the Foundation with accounting models. Double-entry ledger with Account/LedgerEntry. Unit-level monthly charges with payment tracking. Building-level budgets with planned vs actual. CSV import for bank statements. PDF generation for invoices and reports.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, BullMQ, Tailwind CSS, lucide-react, next-intl, jsPDF

**Spec:** `docs/superpowers/specs/2026-03-25-condo-manager-design.md`
**Design refs:** `docs/reference/stitch-unit-payment-design.md`, `docs/reference/stitch-building-budget-design.md`
**GitHub Issues:** #21–#25 in `siposzoltan03/condo-manager`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── finance/
│   │       ├── charges/
│   │       │   ├── route.ts                    # GET list, POST bulk create
│   │       │   ├── summary/
│   │       │   │   └── route.ts                # GET summary (balance, next due, last payment)
│   │       │   └── [id]/
│   │       │       └── route.ts                # PATCH record payment
│   │       ├── ledger/
│   │       │   └── route.ts                    # GET paginated, POST create entry
│   │       ├── budget/
│   │       │   └── route.ts                    # GET budget vs actual, POST set planned amounts
│   │       ├── summary/
│   │       │   └── route.ts                    # GET building financial summary
│   │       └── import/
│   │           └── route.ts                    # POST CSV import
│   └── [locale]/
│       └── finance/
│           ├── page.tsx                        # Unit payment overview (residents/tenants)
│           └── building/
│               └── page.tsx                    # Building budget & ledger (admin/board)
├── components/
│   └── finance/
│       ├── PaymentSummaryCards.tsx             # 3-card summary grid
│       ├── PaymentTrendsChart.tsx              # CSS bar chart (12 months)
│       ├── PaymentHistoryTable.tsx             # Financial history table
│       ├── BudgetSummaryCards.tsx              # 4-card summary grid
│       ├── BudgetActionBar.tsx                 # Filters + action buttons
│       ├── BudgetTable.tsx                     # Budget vs actual with progress bars
│       ├── LedgerTable.tsx                     # Ledger entries table
│       ├── AddExpenseModal.tsx                 # Add expense dialog
│       ├── AddIncomeModal.tsx                  # Add income dialog
│       └── CsvImportDialog.tsx                 # CSV import drag-drop dialog
└── lib/
    └── finance/
        ├── charges.ts                          # Charge query helpers
        ├── ledger.ts                           # Ledger query helpers
        ├── budget.ts                           # Budget query helpers
        └── csv-import.ts                       # CSV parsing utilities
prisma/
└── schema.prisma                               # Extended with finance models
messages/
├── en.json                                     # finance.* i18n keys added
└── nl.json                                     # finance.* i18n keys added
```

---

## Task 1: Finance Database Schema (Issue #21)

**Commit message:** `feat(finance): add Finance schema — Account, LedgerEntry, MonthlyCharge, Budget`

### Steps

- [ ] Open `prisma/schema.prisma`
- [ ] Add `AccountType` enum:
  ```prisma
  enum AccountType {
    ASSET
    LIABILITY
    INCOME
    EXPENSE
  }
  ```
- [ ] Add `ChargeStatus` enum:
  ```prisma
  enum ChargeStatus {
    PAID
    UNPAID
    OVERDUE
  }
  ```
- [ ] Add `Account` model:
  ```prisma
  model Account {
    id            String      @id @default(cuid())
    name          String
    type          AccountType
    parentId      String?
    parent        Account?    @relation("AccountChildren", fields: [parentId], references: [id])
    children      Account[]   @relation("AccountChildren")
    createdAt     DateTime    @default(now())
    debitEntries  LedgerEntry[] @relation("DebitAccount")
    creditEntries LedgerEntry[] @relation("CreditAccount")
    budgets       Budget[]

    @@index([type])
  }
  ```
- [ ] Add `LedgerEntry` model:
  ```prisma
  model LedgerEntry {
    id              String   @id @default(cuid())
    date            DateTime
    debitAccountId  String
    debitAccount    Account  @relation("DebitAccount", fields: [debitAccountId], references: [id])
    creditAccountId String
    creditAccount   Account  @relation("CreditAccount", fields: [creditAccountId], references: [id])
    amount          Decimal  @db.Decimal(12, 2)
    description     String
    receiptUrl      String?
    createdById     String
    createdBy       User     @relation("LedgerEntryCreator", fields: [createdById], references: [id])
    createdAt       DateTime @default(now())

    @@index([date])
    @@index([debitAccountId])
    @@index([creditAccountId])
  }
  ```
- [ ] Add `MonthlyCharge` model:
  ```prisma
  model MonthlyCharge {
    id        String       @id @default(cuid())
    unitId    String
    unit      Unit         @relation(fields: [unitId], references: [id])
    month     String       // "YYYY-MM"
    amount    Decimal      @db.Decimal(10, 2)
    status    ChargeStatus @default(UNPAID)
    paidAt    DateTime?
    createdAt DateTime     @default(now())

    @@unique([unitId, month])
    @@index([status])
  }
  ```
- [ ] Add `Budget` model:
  ```prisma
  model Budget {
    id            String  @id @default(cuid())
    year          Int
    accountId     String
    account       Account @relation(fields: [accountId], references: [id])
    plannedAmount Decimal @db.Decimal(12, 2)

    @@unique([year, accountId])
  }
  ```
- [ ] Add relation to `User` model: `ledgerEntries LedgerEntry[] @relation("LedgerEntryCreator")`
- [ ] Add relation to `Unit` model: `monthlyCharges MonthlyCharge[]`
- [ ] Update `prisma/seed.ts` to seed default chart of accounts:
  - EXPENSE: Maintenance, Utilities, Insurance, Reserve Fund Contribution, Management Fees, Security
  - INCOME: Common Charges, Other Income
  - ASSET: Current Fund, Reserve Fund
  - LIABILITY: Accounts Payable
- [ ] Run `npx prisma migrate dev --name add-finance-schema`
- [ ] Run `npx prisma db seed` to verify seed works
- [ ] Commit: `feat(finance): add Finance schema — Account, LedgerEntry, MonthlyCharge, Budget`

---

## Task 2: Unit Payment Tracking API (Issue #22)

**Commit message:** `feat(finance): unit payment tracking API — charges CRUD + summary endpoint`

### Endpoints

| Method | Path                             | Description                                    | Auth              |
|--------|----------------------------------|------------------------------------------------|-------------------|
| GET    | /api/finance/charges             | List monthly charges (year filter, pagination) | Resident/Tenant/Admin |
| GET    | /api/finance/charges/summary     | Current balance, next due, last payment        | Resident/Tenant/Admin |
| POST   | /api/finance/charges             | Bulk create charges for all units              | Admin/Board only  |
| PATCH  | /api/finance/charges/[id]        | Record payment (set PAID + paidAt)             | Admin/Board only  |

### Steps

- [ ] Create `src/app/api/finance/charges/route.ts`
  - GET: resolve unit from session (residents see own, admin sees all with `unitId` query param). Accept `year` query param. Return paginated list of `MonthlyCharge`.
  - POST: admin/board only. Accept array of `{ unitId, month, amount }`. Bulk insert with `createMany`. Return count.
- [ ] Create `src/app/api/finance/charges/summary/route.ts`
  - GET: returns `{ currentBalance, nextDue: { amount, month }, lastPayment: { amount, paidAt } }` for a given unit.
- [ ] Create `src/app/api/finance/charges/[id]/route.ts`
  - PATCH: admin/board only. Set `status = PAID`, `paidAt = new Date()`. Write audit log entry.
- [ ] Apply role guards (use existing `withAuth` / session check pattern from codebase).
- [ ] Write audit log for PATCH (payment recorded by whom + timestamp).
- [ ] Commit: `feat(finance): unit payment tracking API — charges CRUD + summary endpoint`

---

## Task 3: Unit Payment Overview UI (Issue #23)

**Commit message:** `feat(finance): unit payment overview page — summary cards, trends chart, history table`

### Steps

- [ ] Create `src/app/[locale]/finance/page.tsx`
  - Server component: fetch summary + charge list for current user's unit via internal API or direct Prisma call.
  - Pass data to client components.
- [ ] Create `src/components/finance/PaymentSummaryCards.tsx`
  - 3-card grid matching Stitch design (see `docs/reference/stitch-unit-payment-design.md`).
  - Card 1: Current Balance + "fully settled" indicator.
  - Card 2: Next Payment Due + PAY NOW button (triggers PATCH to mark paid — admin only; residents see amount only).
  - Card 3: Payment Status badge (SUCCESSFULLY PAID / OVERDUE / PENDING).
- [ ] Create `src/components/finance/PaymentTrendsChart.tsx`
  - Pure CSS bar chart — no charting library.
  - 12 bars, heights proportional to amount (normalize to max).
  - Current month: `bg-primary`. Future: dashed border. Past: `bg-primary-fixed`.
  - Year selector dropdown — on change refetches data.
- [ ] Create `src/components/finance/PaymentHistoryTable.tsx`
  - Columns: Month + Invoice ID, Amount, Due Date, Paid Date, Status badge, Actions (receipt icon).
  - Status badges per Stitch spec (green/red/amber).
  - Filter button (client-side filter by status).
  - Export CSV button (generates CSV client-side from loaded data).
  - Receipt download button (placeholder — links to `receiptUrl` if available).
- [ ] Add i18n keys to `messages/en.json` and `messages/nl.json` under `finance.*`:
  - `finance.title`, `finance.currentBalance`, `finance.nextPaymentDue`, `finance.paymentStatus`,
  - `finance.fullySettled`, `finance.payNow`, `finance.successfullyPaid`, `finance.overdue`, `finance.pending`,
  - `finance.monthlyTrends`, `finance.financialHistory`, `finance.filter`, `finance.exportCsv`,
  - `finance.month`, `finance.amount`, `finance.dueDate`, `finance.paidDate`, `finance.status`, `finance.actions`
- [ ] Commit: `feat(finance): unit payment overview page — summary cards, trends chart, history table`

---

## Task 4: Building Budget & Ledger API (Issue #24)

**Commit message:** `feat(finance): building budget & ledger API — summary, ledger, budget, CSV import`

### Endpoints

| Method | Path                    | Description                                         | Auth         |
|--------|-------------------------|-----------------------------------------------------|--------------|
| GET    | /api/finance/summary    | Fund balances, total income/expenses for period     | Admin/Board  |
| GET    | /api/finance/ledger     | Paginated ledger with date range + category filters | Admin/Board  |
| POST   | /api/finance/ledger     | Create ledger entry (double-entry validation)       | Admin/Board  |
| GET    | /api/finance/budget     | Budget vs actual for a year, grouped by account     | Admin/Board  |
| POST   | /api/finance/budget     | Set/update planned amounts                          | Admin/Board  |
| POST   | /api/finance/import     | CSV import — parse and create ledger entries        | Admin only   |

### Steps

- [ ] Create `src/app/api/finance/summary/route.ts`
  - GET: aggregate `LedgerEntry` credits/debits for INCOME and EXPENSE accounts in given period. Return fund balances from ASSET accounts. Accept `from` and `to` query params (default: current year).
- [ ] Create `src/app/api/finance/ledger/route.ts`
  - GET: paginated `LedgerEntry` list with filters (`from`, `to`, `accountId`). Include account names.
  - POST: validate that `debitAccountId !== creditAccountId`, `amount > 0`. Create entry. Write audit log.
- [ ] Create `src/app/api/finance/budget/route.ts`
  - GET: for a given `year`, return all accounts with `plannedAmount` and aggregated actual from `LedgerEntry`.
  - POST: upsert `Budget` records (array of `{ accountId, year, plannedAmount }`). Admin/Board only.
- [ ] Create `src/app/api/finance/import/route.ts`
  - POST: accept multipart form data with CSV file. Parse using `csv-parse` (or native split). Map columns (date, description, debit, credit, balance). Create `LedgerEntry` records in a transaction. Return `{ created, errors }`. Admin only.
- [ ] Create `src/lib/finance/csv-import.ts`: CSV row type, validation, account auto-mapping logic.
- [ ] All mutations: write to audit log.
- [ ] Commit: `feat(finance): building budget & ledger API — summary, ledger, budget, CSV import`

---

## Task 5: Building Budget & Ledger UI (Issue #25)

**Commit message:** `feat(finance): building budget & ledger page — summary cards, budget table, ledger table`

### Steps

- [ ] Create `src/app/[locale]/finance/building/page.tsx`
  - Server component with role guard (redirect non-admin/board to `/finance`).
  - Fetch summary, budget, ledger via internal API or direct Prisma.
  - Pass data to client components.
- [ ] Create `src/components/finance/BudgetSummaryCards.tsx`
  - 4-card grid matching Stitch design (see `docs/reference/stitch-building-budget-design.md`).
  - Cards: Current Fund Balance (+% badge), Reserve Fund, Total Income YTD, Total Expenses YTD.
- [ ] Create `src/components/finance/BudgetActionBar.tsx`
  - Date range picker (From/To inputs), Category filter dropdown.
  - Add Expense button (opens `AddExpenseModal`), Add Income button (opens `AddIncomeModal`).
  - Import Bank Statement button (opens `CsvImportDialog`).
  - Generate Report button (calls `/api/finance/summary` + generates PDF via jsPDF — placeholder OK).
- [ ] Create `src/components/finance/BudgetTable.tsx`
  - col-span-5 in 12-col grid.
  - Columns: Category, Planned, Actual, Progress bar.
  - Over-budget rows: `bg-error` bar + `bg-error-container/20` row background.
  - Totals row at bottom.
- [ ] Create `src/components/finance/LedgerTable.tsx`
  - col-span-7 in 12-col grid.
  - Columns: Date, Description + category badge, Debit (red), Credit (green), Balance.
  - Paginated with "Load more" or page controls.
- [ ] Create `src/components/finance/AddExpenseModal.tsx`
  - Fields: Date, Account (select from EXPENSE accounts), Description, Amount, Receipt upload.
  - POST to `/api/finance/ledger` on submit.
- [ ] Create `src/components/finance/AddIncomeModal.tsx`
  - Fields: Date, Account (select from INCOME accounts), Description, Amount.
  - POST to `/api/finance/ledger` on submit.
- [ ] Create `src/components/finance/CsvImportDialog.tsx`
  - Drag-and-drop file zone (accept `.csv`).
  - Show preview of first 5 rows after file selection.
  - POST to `/api/finance/import` on confirm.
  - Show result summary (`{ created, errors }`).
- [ ] Add i18n keys under `finance.building.*`:
  - `finance.building.title`, `finance.building.currentFund`, `finance.building.reserveFund`,
  - `finance.building.totalIncomeYtd`, `finance.building.totalExpensesYtd`,
  - `finance.building.addExpense`, `finance.building.addIncome`, `finance.building.importStatement`,
  - `finance.building.generateReport`, `finance.building.budgetOverview`, `finance.building.ledgerEntries`,
  - `finance.building.category`, `finance.building.planned`, `finance.building.actual`,
  - `finance.building.date`, `finance.building.description`, `finance.building.debit`, `finance.building.credit`, `finance.building.balance`
- [ ] Commit: `feat(finance): building budget & ledger page — summary cards, budget table, ledger table`

---

## Task 6: Finance Sidebar Update

**Commit message:** `feat(finance): update sidebar navigation for Finance module`

### Steps

- [ ] Locate sidebar component (likely `src/components/layout/Sidebar.tsx` or similar).
- [ ] Add Finance nav item:
  - Icon: `Wallet` or `CreditCard` from lucide-react
  - Label: `t('nav.finance')`
  - Link: `/finance` for all roles
- [ ] Apply role-based sub-navigation or tab switching:
  - Residents/Tenants: `/finance` → Unit Payment Overview
  - Admin/Board: `/finance` → Unit Payment Overview (with unit selector) + tab/link to `/finance/building`
  - OR: use tabs within `/finance` page header to switch between "My Payments" and "Building Finance"
- [ ] Add i18n keys: `nav.finance`, `nav.financeBuilding`
- [ ] Commit: `feat(finance): update sidebar navigation for Finance module`

---

## Summary

| Task | Issue | Description                          |
|------|-------|--------------------------------------|
| 1    | #21   | Finance Database Schema              |
| 2    | #22   | Unit Payment Tracking API            |
| 3    | #23   | Unit Payment Overview UI             |
| 4    | #24   | Building Budget & Ledger API         |
| 5    | #25   | Building Budget & Ledger UI          |
| 6    | —     | Finance Sidebar Update               |

Run tasks sequentially: schema → API → UI. Tasks 2+4 (APIs) can be done in parallel after Task 1. Tasks 3+5 (UIs) can be done in parallel after their respective APIs.
