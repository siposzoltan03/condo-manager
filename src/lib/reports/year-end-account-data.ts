import { prisma } from "@/lib/prisma";

export interface YearEndAccountData {
  buildingName: string;
  year: number;
  /** Total ASSET balance at Jan 1 (debits − credits up to that date). */
  openingBalance: number;
  /** Total ASSET balance at Dec 31 23:59. */
  closingBalance: number;
  /** Year-total income across INCOME accounts. */
  totalIncome: number;
  /** Year-total expenses across EXPENSE accounts. */
  totalExpenses: number;
  /** Net change for the year. */
  netChange: number;
  /** Asset balances broken down by account. */
  assets: { name: string; balance: number }[];
  /** Liabilities broken down by account. */
  liabilities: { name: string; balance: number }[];
  /** Outstanding charges as at Dec 31 — separate from ledger liabilities. */
  arrears: { unitsCount: number; total: number };
  /** Budget rows: planned vs actual (sum of debits-minus-credits per account). */
  budget: {
    accountName: string;
    planned: number;
    actual: number;
    /** actual / planned (1.0 = on-target). */
    ratio: number;
  }[];
  budgetPlannedTotal: number;
  budgetActualTotal: number;
  /** Top-level expense categorisation (re-using the same buckets as the
   *  monthly summary so line items align across reports). */
  expenseByCategory: { category: string; amount: number }[];
  /** Utility-only ("rezsi") subset, surfaced separately to satisfy the
   *  Tht. § 43/A statutory expectation that owners can see utility
   *  spend distinctly from operations. */
  rezsiBreakdown: { name: string; amount: number }[];
  /** Per-tulajdonos annual cost allocation. Sorted by unit number. */
  perOwner: {
    unitNumber: string;
    ownerName: string;
    ownershipShare: number; // 0..1
    annualPaid: number; // sum of paid monthly-charge amounts in the year
    annualBilled: number; // sum of all monthly-charge amounts in the year
    outstanding: number; // billed − paid
  }[];
  perOwnerTotalBilled: number;
  perOwnerTotalPaid: number;
}

const REZSI_KEYWORDS = [
  "közüz",
  "áram",
  "víz",
  "gáz",
  "fűt",
  "hő",
  "utilit", // English label fallback for cross-locale charts of accounts
];

function categorizeAccount(accountName: string): string {
  const n = accountName.toLowerCase();
  if (n.includes("közös") || n.includes("lakó")) return "lakói díj";
  if (n.includes("karbant") || n.includes("javít")) return "karbantartás";
  if (REZSI_KEYWORDS.some((k) => n.includes(k))) return "közüzemi";
  if (n.includes("biztos")) return "biztosítás";
  if (n.includes("takar")) return "takarítás";
  if (n.includes("admin")) return "adminisztráció";
  if (n.includes("kert")) return "kertészet";
  if (n.includes("tartalék") || n.includes("reserve")) return "tartalék";
  return "egyéb";
}

function isRezsi(accountName: string): boolean {
  return REZSI_KEYWORDS.some((k) => accountName.toLowerCase().includes(k));
}

async function sumAssetBalanceBefore(
  assetIds: string[],
  before: Date,
): Promise<number> {
  if (assetIds.length === 0) return 0;
  const [deb, cre] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { debitAccountId: { in: assetIds }, date: { lt: before } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { creditAccountId: { in: assetIds }, date: { lt: before } },
      _sum: { amount: true },
    }),
  ]);
  return Number(deb._sum.amount ?? 0) - Number(cre._sum.amount ?? 0);
}

/**
 * Compute the canonical data payload for a year-end-account PDF.
 *
 * `period` is `"YYYY"`. RBAC is the route's responsibility.
 */
export async function computeYearEndAccountData(
  buildingId: string,
  yearStr: string,
): Promise<YearEndAccountData> {
  if (!/^\d{4}$/.test(yearStr)) {
    throw new Error(`Invalid year "${yearStr}", expected YYYY`);
  }
  const year = Number(yearStr);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true },
  });
  if (!building) throw new Error(`Building ${buildingId} not found`);

  const accounts = await prisma.account.findMany({
    where: { buildingId },
    select: { id: true, name: true, type: true },
  });

  const assetIds = accounts.filter((a) => a.type === "ASSET").map((a) => a.id);
  const liabilityIds = accounts
    .filter((a) => a.type === "LIABILITY")
    .map((a) => a.id);

  // Year-bounded ledger.
  const yearEntries = await prisma.ledgerEntry.findMany({
    where: {
      date: { gte: yearStart, lt: yearEnd },
      OR: [
        { debitAccount: { buildingId } },
        { creditAccount: { buildingId } },
      ],
    },
    include: {
      debitAccount: { select: { id: true, name: true, type: true } },
      creditAccount: { select: { id: true, name: true, type: true } },
    },
  });

  const [openingBalance, closingBalance] = await Promise.all([
    sumAssetBalanceBefore(assetIds, yearStart),
    sumAssetBalanceBefore(assetIds, yearEnd),
  ]);

  // Income / expense totals + categorisation.
  const expenseByCategoryMap = new Map<string, number>();
  const rezsiByAccountMap = new Map<string, number>();
  const accountActuals = new Map<string, number>(); // for budget comparison
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const e of yearEntries) {
    const amt = Number(e.amount);
    if (e.creditAccount.type === "INCOME") {
      totalIncome += amt;
      accountActuals.set(
        e.creditAccount.id,
        (accountActuals.get(e.creditAccount.id) ?? 0) + amt,
      );
    } else if (e.debitAccount.type === "EXPENSE") {
      totalExpenses += amt;
      const cat = categorizeAccount(e.debitAccount.name);
      expenseByCategoryMap.set(
        cat,
        (expenseByCategoryMap.get(cat) ?? 0) + amt,
      );
      if (isRezsi(e.debitAccount.name)) {
        rezsiByAccountMap.set(
          e.debitAccount.name,
          (rezsiByAccountMap.get(e.debitAccount.name) ?? 0) + amt,
        );
      }
      accountActuals.set(
        e.debitAccount.id,
        (accountActuals.get(e.debitAccount.id) ?? 0) + amt,
      );
    }
  }

  const expenseByCategory = Array.from(expenseByCategoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const rezsiBreakdown = Array.from(rezsiByAccountMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Per-account asset balances (snapshot at year end).
  const assets = await Promise.all(
    accounts
      .filter((a) => a.type === "ASSET")
      .map(async (a) => {
        const [deb, cre] = await Promise.all([
          prisma.ledgerEntry.aggregate({
            where: { debitAccountId: a.id, date: { lt: yearEnd } },
            _sum: { amount: true },
          }),
          prisma.ledgerEntry.aggregate({
            where: { creditAccountId: a.id, date: { lt: yearEnd } },
            _sum: { amount: true },
          }),
        ]);
        return {
          name: a.name,
          balance: Number(deb._sum.amount ?? 0) - Number(cre._sum.amount ?? 0),
        };
      }),
  );
  // Liabilities are credit-normal — invert.
  const liabilities = await Promise.all(
    accounts
      .filter((a) => a.type === "LIABILITY")
      .map(async (a) => {
        const [deb, cre] = await Promise.all([
          prisma.ledgerEntry.aggregate({
            where: { debitAccountId: a.id, date: { lt: yearEnd } },
            _sum: { amount: true },
          }),
          prisma.ledgerEntry.aggregate({
            where: { creditAccountId: a.id, date: { lt: yearEnd } },
            _sum: { amount: true },
          }),
        ]);
        return {
          name: a.name,
          balance: Number(cre._sum.amount ?? 0) - Number(deb._sum.amount ?? 0),
        };
      }),
  );
  void liabilityIds;

  // Budget rows (year).
  const budgets = await prisma.budget.findMany({
    where: { year, account: { buildingId } },
    include: { account: { select: { id: true, name: true } } },
  });
  let budgetPlannedTotal = 0;
  let budgetActualTotal = 0;
  const budget = budgets
    .map((b) => {
      const planned = Number(b.plannedAmount);
      const actual = accountActuals.get(b.account.id) ?? 0;
      budgetPlannedTotal += planned;
      budgetActualTotal += actual;
      return {
        accountName: b.account.name,
        planned,
        actual,
        ratio: planned > 0 ? actual / planned : 0,
      };
    })
    .sort((a, b) => b.planned - a.planned);

  // Per-tulajdonos breakdown.
  const units = await prisma.unit.findMany({
    where: { buildingId },
    include: {
      unitUsers: {
        where: { relationship: "OWNER" },
        select: { user: { select: { name: true } } },
      },
      monthlyCharges: {
        where: {
          month: {
            // Filter to YYYY-MM strings within the target year.
            startsWith: `${year}-`,
          },
        },
        select: { amount: true, status: true, paidAt: true },
      },
    },
  });
  const perOwner = units
    .map((u) => {
      const ownerName =
        u.unitUsers[0]?.user.name ?? "—";
      let billed = 0;
      let paid = 0;
      for (const c of u.monthlyCharges) {
        const amt = Number(c.amount);
        billed += amt;
        if (c.status === "PAID") paid += amt;
      }
      return {
        unitNumber: u.number,
        ownerName,
        ownershipShare: Number(u.ownershipShare),
        annualPaid: paid,
        annualBilled: billed,
        outstanding: billed - paid,
      };
    })
    .sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );

  const perOwnerTotalBilled = perOwner.reduce((s, p) => s + p.annualBilled, 0);
  const perOwnerTotalPaid = perOwner.reduce((s, p) => s + p.annualPaid, 0);
  const arrearsTotal = perOwner.reduce((s, p) => s + p.outstanding, 0);
  const arrearsUnits = perOwner.filter((p) => p.outstanding > 0).length;

  return {
    buildingName: building.name,
    year,
    openingBalance,
    closingBalance,
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    assets,
    liabilities,
    arrears: { unitsCount: arrearsUnits, total: arrearsTotal },
    budget,
    budgetPlannedTotal,
    budgetActualTotal,
    expenseByCategory,
    rezsiBreakdown,
    perOwner,
    perOwnerTotalBilled,
    perOwnerTotalPaid,
  };
}
