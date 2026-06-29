import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";

// ─── Shared types ─────────────────────────────────────────────────────────

export interface FinanceKPI {
  /** ASSET ledger position on operating-cash accounts (Ft, signed). */
  operatingBalance: number;
  /** ASSET ledger position on reserve-fund accounts (Ft, signed). */
  reserveBalance: number;
  /** Reserve target — placeholder until Building.reserveTarget lands. */
  reserveTarget: number;
  /** Income YTD (sum of credits on INCOME accounts since Jan 1). */
  incomeYTD: number;
  /** Expense YTD (sum of debits on EXPENSE accounts since Jan 1). */
  expenseYTD: number;
  /** 8 monthly net values for the income sparkline. */
  incomeSparkline: number[];
  /** Operating balance change vs. last month, in Ft. */
  operatingMonthlyDelta: number;
}

export interface FinanceLedgerRow {
  id: string;
  date: string;
  description: string;
  /** Signed amount (positive = income, negative = expense, from caller perspective). */
  amount: number;
  debitAccountName: string;
  creditAccountName: string;
  /** Income / expense classification derived from account types. */
  kind: "income" | "expense" | "internal";
  /** Hungarian category label, e.g. "lakói", "karbantartás", "közüzemi". */
  category: string;
}

export interface FinanceBudgetRow {
  accountId: string;
  accountName: string;
  planned: number;
  actual: number;
  /** Computed: actual / planned, can exceed 1.0 for over-budget. */
  ratio: number;
}

export interface FinanceUnitRow {
  unitId: string;
  unitLabel: string;
  ownerName: string;
  ownerSize: string;
  ownershipShare: number;
  monthlyFee: number;
  outstandingBalance: number;
  /** 12 entries, current year Jan→Dec. */
  monthlyStatus: ("paid" | "overdue" | "pending" | "future")[];
  lastPaidAt: string | null;
}

// ─── Overview KPIs (used by Áttekintés + the dashboard) ──────────────────

const HU_MONTH = ["JAN", "FEB", "MÁR", "ÁPR", "MÁJ", "JÚN", "JÚL", "AUG", "SZE", "OKT", "NOV", "DEC"];

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function loadKPI(buildingId: string): Promise<FinanceKPI> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 7, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [opAccounts, resAccounts, ledgerForChart, lastMonthLedger] = await Promise.all([
    prisma.account.findMany({
      where: {
        buildingId,
        type: "ASSET",
        OR: [
          { name: { contains: "Current", mode: "insensitive" } },
          { name: { contains: "Operating", mode: "insensitive" } },
          { name: { contains: "Folyó", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
    prisma.account.findMany({
      where: {
        buildingId,
        type: "ASSET",
        OR: [
          { name: { contains: "Reserve", mode: "insensitive" } },
          { name: { contains: "Tartalék", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        date: { gte: eightMonthsAgo },
        OR: [
          { debitAccount: { buildingId, type: "EXPENSE" } },
          { creditAccount: { buildingId, type: "INCOME" } },
        ],
      },
      select: {
        date: true,
        amount: true,
        debitAccount: { select: { type: true, buildingId: true } },
        creditAccount: { select: { type: true, buildingId: true } },
      },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        date: { gte: lastMonthStart, lt: thisMonthStart },
        OR: [{ debitAccount: { buildingId } }, { creditAccount: { buildingId } }],
      },
      _sum: { amount: true },
    }),
  ]);

  const opIds = opAccounts.map((a) => a.id);
  const resIds = resAccounts.map((a) => a.id);

  const [opDeb, opCre, resDeb, resCre] = await Promise.all([
    opIds.length
      ? prisma.ledgerEntry.aggregate({ where: { debitAccountId: { in: opIds } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    opIds.length
      ? prisma.ledgerEntry.aggregate({ where: { creditAccountId: { in: opIds } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    resIds.length
      ? prisma.ledgerEntry.aggregate({ where: { debitAccountId: { in: resIds } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
    resIds.length
      ? prisma.ledgerEntry.aggregate({ where: { creditAccountId: { in: resIds } }, _sum: { amount: true } })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const operatingBalance = Number(opDeb._sum.amount ?? 0) - Number(opCre._sum.amount ?? 0);
  const reserveBalance = Number(resDeb._sum.amount ?? 0) - Number(resCre._sum.amount ?? 0);

  // Income/expense aggregation for chart + YTD.
  const monthlyIncome = new Map<string, number>();
  let incomeYTD = 0;
  let expenseYTD = 0;
  for (const e of ledgerForChart) {
    const amt = Number(e.amount);
    if (
      e.creditAccount?.type === "INCOME" &&
      e.creditAccount.buildingId === buildingId
    ) {
      const k = ymKey(e.date);
      monthlyIncome.set(k, (monthlyIncome.get(k) ?? 0) + amt);
      if (e.date >= yearStart) incomeYTD += amt;
    } else if (
      e.debitAccount?.type === "EXPENSE" &&
      e.debitAccount.buildingId === buildingId
    ) {
      if (e.date >= yearStart) expenseYTD += amt;
    }
  }

  const incomeSparkline: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    incomeSparkline.push(monthlyIncome.get(ymKey(d)) ?? 0);
  }

  return {
    operatingBalance,
    reserveBalance,
    reserveTarget: 32_000_000,
    incomeYTD,
    expenseYTD,
    incomeSparkline,
    operatingMonthlyDelta: Number(lastMonthLedger._sum.amount ?? 0),
  };
}

void HU_MONTH;

// ─── Áttekintés ────────────────────────────────────────────────────────────

export interface FinanceOverviewBoardData {
  kpi: FinanceKPI;
  ledgerPreview: FinanceLedgerRow[];
  ledgerTotal: number;
  budgetPreview: FinanceBudgetRow[];
  budgetPlannedTotal: number;
  budgetActualTotal: number;
  /** Quick stats for the units arrears summary card on the overview page. */
  arrearsUnitsCount: number;
  arrearsTotal: number;
  totalUnits: number;
  /** Last bank-sync timestamp ISO; null if never synced. */
  lastSyncAt: string | null;
}

function categorizeAccount(accountName: string): string {
  const n = accountName.toLowerCase();
  if (n.includes("közös") || n.includes("lakó")) return "lakói";
  if (n.includes("karbant") || n.includes("javít")) return "karbantartás";
  if (n.includes("közüz") || n.includes("áram") || n.includes("víz") || n.includes("gáz")) return "közüzemi";
  if (n.includes("biztos")) return "biztosítás";
  if (n.includes("takar")) return "takarítás";
  if (n.includes("admin")) return "adminisztráció";
  if (n.includes("kert")) return "kertészet";
  return "egyéb";
}

function ledgerRow(e: {
  id: string;
  date: Date;
  description: string;
  amount: import("@prisma/client/runtime/library").Decimal;
  debitAccount: { name: string; type: string };
  creditAccount: { name: string; type: string };
}): FinanceLedgerRow {
  const isIncome = e.creditAccount.type === "INCOME";
  const isExpense = e.debitAccount.type === "EXPENSE";
  const kind: "income" | "expense" | "internal" = isIncome
    ? "income"
    : isExpense
      ? "expense"
      : "internal";
  const category = isIncome
    ? categorizeAccount(e.creditAccount.name)
    : isExpense
      ? categorizeAccount(e.debitAccount.name)
      : "belső átvezetés";
  return {
    id: e.id,
    date: e.date.toISOString(),
    description: e.description,
    amount: kind === "expense" ? -Number(e.amount) : Number(e.amount),
    debitAccountName: e.debitAccount.name,
    creditAccountName: e.creditAccount.name,
    kind,
    category,
  };
}

export const getFinanceOverviewBoard = cache(
  async (): Promise<FinanceOverviewBoardData> => {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    requireCapability(ctx, "view.building.finance");

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      kpi,
      ledgerPreviewRaw,
      ledgerTotal,
      budgets,
      ledgerForBudget,
      arrearsCharges,
      totalUnits,
      lastSyncEntry,
    ] = await Promise.all([
      loadKPI(buildingId),
      prisma.ledgerEntry.findMany({
        where: {
          OR: [{ debitAccount: { buildingId } }, { creditAccount: { buildingId } }],
        },
        include: {
          debitAccount: { select: { name: true, type: true } },
          creditAccount: { select: { name: true, type: true } },
        },
        orderBy: { date: "desc" },
        take: 8,
      }),
      prisma.ledgerEntry.count({
        where: {
          OR: [{ debitAccount: { buildingId } }, { creditAccount: { buildingId } }],
        },
      }),
      prisma.budget.findMany({
        where: { year: now.getFullYear(), account: { buildingId } },
        include: { account: { select: { id: true, name: true, type: true } } },
        take: 6,
      }),
      prisma.ledgerEntry.findMany({
        where: {
          date: { gte: yearStart },
          OR: [{ debitAccount: { buildingId } }, { creditAccount: { buildingId } }],
        },
        select: { amount: true, debitAccountId: true, creditAccountId: true },
      }),
      prisma.monthlyCharge.findMany({
        where: { unit: { buildingId }, status: { in: ["UNPAID", "OVERDUE"] } },
        select: { unitId: true, amount: true },
      }),
      prisma.unit.count({ where: { buildingId } }),
      prisma.ledgerEntry.findFirst({
        where: {
          OR: [{ debitAccount: { buildingId } }, { creditAccount: { buildingId } }],
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const ledgerPreview = ledgerPreviewRaw.map(ledgerRow);

    let budgetPlannedTotal = 0;
    let budgetActualTotal = 0;
    const budgetPreview: FinanceBudgetRow[] = budgets.map((b) => {
      const planned = Number(b.plannedAmount);
      const actual = ledgerForBudget
        .filter(
          (e) =>
            e.debitAccountId === b.accountId || e.creditAccountId === b.accountId,
        )
        .reduce((s, e) => s + Number(e.amount), 0);
      budgetPlannedTotal += planned;
      budgetActualTotal += actual;
      return {
        accountId: b.account.id,
        accountName: b.account.name,
        planned,
        actual,
        ratio: planned > 0 ? actual / planned : 0,
      };
    });

    const arrearsTotal = arrearsCharges.reduce((s, c) => s + Number(c.amount), 0);
    const arrearsUnitsCount = new Set(arrearsCharges.map((c) => c.unitId)).size;

    return {
      kpi,
      ledgerPreview,
      ledgerTotal,
      budgetPreview,
      budgetPlannedTotal,
      budgetActualTotal,
      arrearsUnitsCount,
      arrearsTotal,
      totalUnits,
      lastSyncAt: lastSyncEntry?.createdAt.toISOString() ?? null,
    };
  },
);

// ─── Ledger view ──────────────────────────────────────────────────────────

export interface FinanceLedgerData {
  rows: FinanceLedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  categories: { id: string; name: string; type: string }[];
}

export const getFinanceLedger = cache(
  async (page = 1, pageSize = 30, accountId?: string): Promise<FinanceLedgerData> => {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    requireCapability(ctx, "view.building.finance");

    const where = accountId
      ? {
          OR: [
            { debitAccountId: accountId },
            { creditAccountId: accountId },
          ],
        }
      : {
          OR: [
            { debitAccount: { buildingId } },
            { creditAccount: { buildingId } },
          ],
        };

    const [rows, total, accounts] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: {
          debitAccount: { select: { name: true, type: true } },
          creditAccount: { select: { name: true, type: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ledgerEntry.count({ where }),
      prisma.account.findMany({
        where: { buildingId },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      rows: rows.map(ledgerRow),
      total,
      page,
      pageSize,
      categories: accounts,
    };
  },
);

// ─── Units (per-unit payment status grid) ─────────────────────────────────

export interface FinanceUnitsData {
  rows: FinanceUnitRow[];
  /** Aggregate stats for the page header chips. */
  summary: {
    totalUnits: number;
    healthyCount: number;
    arrearsCount: number;
    pendingMatchCount: number;
    arrearsTotalFt: number;
  };
}

export const getFinanceUnits = cache(async (): Promise<FinanceUnitsData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "view.building.finance");

  const year = new Date().getFullYear();
  const monthKeys = Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`,
  );

  const units = await prisma.unit.findMany({
    where: { buildingId },
    include: {
      monthlyCharges: {
        where: { month: { in: monthKeys } },
        select: { month: true, status: true, amount: true, paidAt: true },
      },
      unitUsers: {
        where: { relationship: "OWNER" },
        include: { user: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rows: FinanceUnitRow[] = units.map((u) => {
    const owner = u.unitUsers[0]?.user;
    const fee = Number(u.monthlyCharges[0]?.amount ?? 0);
    let outstanding = 0;
    let lastPaidAt: Date | null = null;
    const monthlyStatus = monthKeys.map((mk) => {
      const c = u.monthlyCharges.find((c) => c.month === mk);
      if (!c) return mk > currentMonthKey ? "future" : "future";
      if (c.status === "PAID") {
        if (c.paidAt && (!lastPaidAt || c.paidAt > lastPaidAt)) lastPaidAt = c.paidAt;
        return "paid";
      }
      if (c.status === "OVERDUE") {
        outstanding += Number(c.amount);
        return "overdue";
      }
      // UNPAID
      if (mk < currentMonthKey) {
        outstanding += Number(c.amount);
        return "overdue";
      }
      if (mk === currentMonthKey) {
        outstanding += Number(c.amount);
        return "pending";
      }
      return "future";
    });

    return {
      unitId: u.id,
      unitLabel: u.floor === 0 ? `Fsz. ${u.number}.` : `${u.floor}.em ${u.number}.`,
      ownerName: owner?.name ?? "—",
      ownerSize: `${Number(u.size).toFixed(0)} m² · ${(Number(u.ownershipShare) * 100).toFixed(1)}%`,
      ownershipShare: Number(u.ownershipShare),
      monthlyFee: fee,
      outstandingBalance: -outstanding, // negative = arrears
      monthlyStatus: monthlyStatus as ("paid" | "overdue" | "pending" | "future")[],
      lastPaidAt: lastPaidAt ? (lastPaidAt as Date).toISOString() : null,
    };
  });

  const arrearsTotalFt = rows.reduce(
    (s, r) => s + Math.abs(Math.min(0, r.outstandingBalance)),
    0,
  );
  const arrearsCount = rows.filter((r) => r.outstandingBalance < 0).length;
  const healthyCount = rows.length - arrearsCount;

  return {
    rows,
    summary: {
      totalUnits: rows.length,
      healthyCount,
      arrearsCount,
      pendingMatchCount: 0, // surfaces with banking integration plan
      arrearsTotalFt,
    },
  };
});

// ─── Budget (full year) ──────────────────────────────────────────────────

export interface FinanceBudgetData {
  rows: FinanceBudgetRow[];
  plannedTotal: number;
  actualTotal: number;
  year: number;
}

export const getFinanceBudget = cache(async (): Promise<FinanceBudgetData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "view.building.finance");

  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);

  const [budgets, ledgerForBudget] = await Promise.all([
    prisma.budget.findMany({
      where: { year, account: { buildingId } },
      include: { account: { select: { id: true, name: true, type: true } } },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        date: { gte: yearStart },
        OR: [{ debitAccount: { buildingId } }, { creditAccount: { buildingId } }],
      },
      select: { amount: true, debitAccountId: true, creditAccountId: true },
    }),
  ]);

  let plannedTotal = 0;
  let actualTotal = 0;
  const rows: FinanceBudgetRow[] = budgets.map((b) => {
    const planned = Number(b.plannedAmount);
    const actual = ledgerForBudget
      .filter(
        (e) =>
          e.debitAccountId === b.accountId || e.creditAccountId === b.accountId,
      )
      .reduce((s, e) => s + Number(e.amount), 0);
    plannedTotal += planned;
    actualTotal += actual;
    return {
      accountId: b.account.id,
      accountName: b.account.name,
      planned,
      actual,
      ratio: planned > 0 ? actual / planned : 0,
    };
  });

  return { rows, plannedTotal, actualTotal, year };
});

// ────────────────────────────────────────────────────────────────────────
// /api/finance/charges/[id] route — DAL functions
// ────────────────────────────────────────────────────────────────────────

/**
 * Cross-tenant safe: returns null when `id` doesn't belong to `buildingId`,
 * preventing a leaked charge id from crossing tenants.
 */
export async function findChargeForBuildingScopedUpdate(
  id: string,
  buildingId: string,
) {
  return prisma.monthlyCharge.findFirst({
    where: { id, unit: { buildingId } },
    select: { id: true, status: true, paidAt: true },
  });
}

export async function markChargeAsPaid(id: string) {
  return prisma.monthlyCharge.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
    include: { unit: { select: { number: true } } },
  });
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/accounts — list building accounts
// ────────────────────────────────────────────────────────────────────────

export async function listBuildingAccounts(buildingId: string) {
  return prisma.account.findMany({
    where: { buildingId },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/ledger/export — CSV export
// ────────────────────────────────────────────────────────────────────────

export async function listLedgerEntriesForExport(opts: {
  buildingId: string;
  from: Date | null;
  to: Date | null;
}) {
  const where: import("@prisma/client").Prisma.LedgerEntryWhereInput = {
    OR: [
      { debitAccount: { buildingId: opts.buildingId } },
      { creditAccount: { buildingId: opts.buildingId } },
    ],
  };
  if (opts.from || opts.to) {
    where.date = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  return prisma.ledgerEntry.findMany({
    where,
    include: {
      debitAccount: { select: { name: true } },
      creditAccount: { select: { name: true } },
    },
    orderBy: { date: "asc" },
    take: 10000,
  });
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/charges/summary — per-unit balance summary
// ────────────────────────────────────────────────────────────────────────

/**
 * Cross-tenant safe unit lookup — returns null when `unitId` belongs to
 * a different building.
 */
export async function findUnitInBuilding(unitId: string, buildingId: string) {
  return prisma.unit.findFirst({
    where: { id: unitId, buildingId },
    select: { id: true },
  });
}

/**
 * Resolves the resident's first unit in the active building (used to
 * default the summary scope when no `unitId` param is supplied).
 */
export async function findFirstUserUnitId(userId: string, buildingId: string) {
  const userUnit = await prisma.unitUser.findFirst({
    where: { userId, unit: { buildingId } },
    select: { unitId: true },
  });
  return userUnit?.unitId ?? null;
}

/**
 * Composite summary for the charges UI: open balance + next due + last
 * payment. Returns an empty-shape result when the unit has no charges
 * (matches the route's previous behavior).
 */
export async function getChargeSummaryForUnit(unitId: string) {
  const [unpaid, nextDue, lastPayment] = await Promise.all([
    prisma.monthlyCharge.findMany({
      where: { unitId, status: { in: ["UNPAID", "OVERDUE"] } },
      select: { amount: true },
    }),
    prisma.monthlyCharge.findFirst({
      where: { unitId, status: { in: ["UNPAID", "OVERDUE"] } },
      orderBy: { month: "asc" },
      select: { amount: true, month: true },
    }),
    prisma.monthlyCharge.findFirst({
      where: { unitId, status: "PAID" },
      orderBy: { paidAt: "desc" },
      select: { amount: true, paidAt: true },
    }),
  ]);
  return { unpaid, nextDue, lastPayment };
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/summary — board financial snapshot
// ────────────────────────────────────────────────────────────────────────

/**
 * Composite financial summary for a building over a date range. Bundles
 * 8 aggregate queries (income, expenses, current-fund debits/credits,
 * reserve-fund debits/credits) plus account classification.
 *
 * The "reserve" fund is identified by accounts containing "reserve" in
 * their name (case-insensitive) — this is the legacy convention; a
 * follow-up may introduce a typed `Account.subType` column.
 */
export async function getBuildingFinancialSummary(opts: {
  buildingId: string;
  from: Date;
  to: Date;
}) {
  const dateFilter = { gte: opts.from, lte: opts.to };

  const accounts = await prisma.account.findMany({
    where: { buildingId: opts.buildingId },
    select: { id: true, type: true, name: true },
  });

  const assetIds = accounts.filter((a) => a.type === "ASSET").map((a) => a.id);
  const incomeIds = accounts
    .filter((a) => a.type === "INCOME")
    .map((a) => a.id);
  const expenseIds = accounts
    .filter((a) => a.type === "EXPENSE")
    .map((a) => a.id);
  const reserveIds = accounts
    .filter(
      (a) => a.type === "ASSET" && a.name.toLowerCase().includes("reserve"),
    )
    .map((a) => a.id);
  const currentFundIds = assetIds.filter((id) => !reserveIds.includes(id));

  const [
    incomeCredits,
    expenseDebits,
    currentDebits,
    currentCredits,
    reserveDebits,
    reserveCredits,
  ] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, creditAccountId: { in: incomeIds } },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, debitAccountId: { in: expenseIds } },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, debitAccountId: { in: currentFundIds } },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, creditAccountId: { in: currentFundIds } },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, debitAccountId: { in: reserveIds } },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, creditAccountId: { in: reserveIds } },
    }),
  ]);

  return {
    incomeCredits,
    expenseDebits,
    currentDebits,
    currentCredits,
    reserveDebits,
    reserveCredits,
  };
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/budget — annual budget per building
// ────────────────────────────────────────────────────────────────────────

export async function getBuildingBudgetForYear(opts: {
  buildingId: string;
  year: number;
}) {
  const yearStart = new Date(`${opts.year}-01-01`);
  const yearEnd = new Date(`${opts.year}-12-31T23:59:59.999Z`);

  const expenseAccounts = await prisma.account.findMany({
    where: { type: "EXPENSE", buildingId: opts.buildingId },
    include: { budgets: { where: { year: opts.year } } },
    orderBy: { name: "asc" },
  });

  const actualAmounts = await prisma.ledgerEntry.groupBy({
    by: ["debitAccountId"],
    _sum: { amount: true },
    where: {
      date: { gte: yearStart, lte: yearEnd },
      debitAccountId: { in: expenseAccounts.map((a) => a.id) },
    },
  });

  return { expenseAccounts, actualAmounts };
}

export async function findExpenseAccountIdsInBuilding(opts: {
  buildingId: string;
  accountIds: string[];
}) {
  const rows = await prisma.account.findMany({
    where: {
      id: { in: opts.accountIds },
      type: "EXPENSE",
      buildingId: opts.buildingId,
    },
    select: { id: true },
  });
  return new Set(rows.map((a) => a.id));
}

export async function upsertBudgetItems(
  year: number,
  items: Array<{ accountId: string; plannedAmount: number }>,
) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.budget.upsert({
        where: { year_accountId: { year, accountId: item.accountId } },
        update: {
          plannedAmount: new Prisma.Decimal(item.plannedAmount),
        },
        create: {
          year,
          accountId: item.accountId,
          plannedAmount: new Prisma.Decimal(item.plannedAmount),
        },
      }),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/import — CSV bulk-import
// ────────────────────────────────────────────────────────────────────────

/**
 * Cross-tenant safe account lookup. Returns null if `accountId` doesn't
 * belong to `buildingId`.
 */
export async function findAccountInBuilding(
  accountId: string,
  buildingId: string,
) {
  return prisma.account.findFirst({
    where: { id: accountId, buildingId },
    select: { id: true, buildingId: true, type: true, name: true },
  });
}

/**
 * "Uncategorized" account (legacy convention — match by name) in a
 * building. Used as the default mapping for unspecified debit/credit
 * sides on CSV imports.
 */
export async function findUncategorizedAccountInBuilding(buildingId: string) {
  return prisma.account.findFirst({
    where: {
      name: { contains: "uncategorized", mode: "insensitive" },
      buildingId,
    },
    select: { id: true },
  });
}

/**
 * First account of the given type (alphabetical) in a building. Used as
 * the secondary fallback when no "uncategorized" account exists.
 */
export async function findFirstAccountOfTypeInBuilding(
  buildingId: string,
  type: "ASSET" | "INCOME" | "EXPENSE" | "LIABILITY",
) {
  return prisma.account.findFirst({
    where: { type, buildingId },
    select: { id: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Bulk-create ledger entries in a single transaction. Caller is
 * responsible for cross-tenant validation of the account ids.
 */
export async function createLedgerEntriesBulk(
  entries: Array<{
    date: Date;
    debitAccountId: string;
    creditAccountId: string;
    amount: Prisma.Decimal;
    description: string;
    createdById: string;
  }>,
) {
  return prisma.$transaction(
    entries.map((entry) => prisma.ledgerEntry.create({ data: entry })),
  );
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/charges — list + bulk-create
// ────────────────────────────────────────────────────────────────────────

export async function listBuildingUnitIds(buildingId: string) {
  const rows = await prisma.unit.findMany({
    where: { buildingId },
    select: { id: true },
  });
  return rows.map((u) => u.id);
}

export async function listUserUnitIdsInBuilding(
  userId: string,
  buildingId: string,
) {
  const rows = await prisma.unitUser.findMany({
    where: { userId, unit: { buildingId } },
    select: { unitId: true },
  });
  return rows.map((r) => r.unitId);
}

export async function findUnitIdsInBuilding(opts: {
  buildingId: string;
  candidateIds: string[];
}) {
  const rows = await prisma.unit.findMany({
    where: { id: { in: opts.candidateIds }, buildingId: opts.buildingId },
    select: { id: true },
  });
  return new Set(rows.map((u) => u.id));
}

export async function listChargesPaginated(opts: {
  unitIds: string[];
  year?: string;
  skip: number;
  limit: number;
}) {
  const where: Prisma.MonthlyChargeWhereInput = {
    unitId: { in: opts.unitIds },
  };
  if (opts.year && /^\d{4}$/.test(opts.year)) {
    where.month = { startsWith: opts.year };
  }
  const [charges, total] = await Promise.all([
    prisma.monthlyCharge.findMany({
      where,
      include: { unit: { select: { number: true } } },
      orderBy: { month: "desc" },
      skip: opts.skip,
      take: opts.limit,
    }),
    prisma.monthlyCharge.count({ where }),
  ]);
  return { charges, total };
}

export async function createMonthlyChargesBulk(
  items: Array<{ unitId: string; month: string; amount: number }>,
) {
  return prisma.monthlyCharge.createMany({
    data: items.map((c) => ({
      unitId: c.unitId,
      month: c.month,
      amount: new Prisma.Decimal(c.amount),
    })),
    skipDuplicates: true,
  });
}

// ────────────────────────────────────────────────────────────────────────
// /api/finance/ledger — list + single-entry create
// ────────────────────────────────────────────────────────────────────────

export async function listAllBuildingAccountIds(buildingId: string) {
  const rows = await prisma.account.findMany({
    where: { buildingId },
    select: { id: true },
  });
  return rows.map((a) => a.id);
}

export async function listLedgerEntriesPaginated(opts: {
  buildingAccountIds: string[];
  accountId?: string;
  from?: Date;
  to?: Date;
  skip: number;
  limit: number;
}) {
  const where: Prisma.LedgerEntryWhereInput = opts.accountId
    ? {
        OR: [
          { debitAccountId: opts.accountId },
          { creditAccountId: opts.accountId },
        ],
      }
    : {
        OR: [
          { debitAccountId: { in: opts.buildingAccountIds } },
          { creditAccountId: { in: opts.buildingAccountIds } },
        ],
      };

  if (opts.from || opts.to) {
    where.date = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: {
        debitAccount: { select: { name: true } },
        creditAccount: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      skip: opts.skip,
      take: opts.limit,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return { entries, total };
}

export async function createLedgerEntry(input: {
  date: Date;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  description: string;
  receiptUrl: string | null;
  createdById: string;
}) {
  return prisma.ledgerEntry.create({
    data: {
      date: input.date,
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      amount: new Prisma.Decimal(input.amount),
      description: input.description,
      receiptUrl: input.receiptUrl,
      createdById: input.createdById,
    },
    include: {
      debitAccount: { select: { name: true } },
      creditAccount: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}
