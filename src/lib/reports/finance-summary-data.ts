import { prisma } from "@/lib/prisma";

export interface FinanceSummaryData {
  buildingName: string;
  period: {
    year: number;
    month: number; // 1–12
    label: string; // "2026. április"
    startISO: string;
    endISO: string;
  };
  /** ASSET balance at period start (operating + reserve summed). */
  openingBalance: number;
  /** ASSET balance at period end. */
  closingBalance: number;
  /** Sum of credits on INCOME accounts within the period. */
  totalIncome: number;
  /** Sum of debits on EXPENSE accounts within the period. */
  totalExpenses: number;
  /** income − expenses for the period. */
  netChange: number;
  /** INCOME totals grouped by category (Hungarian label). */
  incomeByCategory: { category: string; amount: number }[];
  /** EXPENSE totals grouped by category (Hungarian label). */
  expenseByCategory: { category: string; amount: number }[];
  /** Top 10 entries by absolute amount within the period. */
  topEntries: {
    id: string;
    date: string;
    description: string;
    amount: number;
    kind: "income" | "expense";
    category: string;
  }[];
  /** 6-month trailing trend up to and including the report period. */
  monthlyTrend: { label: string; income: number; expense: number; net: number }[];
}

const MONTH_HU = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
];

const MONTH_HU_ABBR = [
  "JAN",
  "FEB",
  "MÁR",
  "ÁPR",
  "MÁJ",
  "JÚN",
  "JÚL",
  "AUG",
  "SZE",
  "OKT",
  "NOV",
  "DEC",
];

function categorizeAccount(accountName: string): string {
  const n = accountName.toLowerCase();
  if (n.includes("közös") || n.includes("lakó")) return "lakói díj";
  if (n.includes("karbant") || n.includes("javít")) return "karbantartás";
  if (
    n.includes("közüz") ||
    n.includes("áram") ||
    n.includes("víz") ||
    n.includes("gáz")
  )
    return "közüzemi";
  if (n.includes("biztos")) return "biztosítás";
  if (n.includes("takar")) return "takarítás";
  if (n.includes("admin")) return "adminisztráció";
  if (n.includes("kert")) return "kertészet";
  if (n.includes("tartalék") || n.includes("reserve")) return "tartalék";
  return "egyéb";
}

/**
 * Sum debits − credits across the given asset account ids up to (exclusive)
 * the cutoff date.
 *
 * Asset accounts are debit-normal: a debit increases balance, a credit
 * decreases. For the reports we want the net balance held at a point in time.
 */
async function sumAssetBalanceBefore(
  assetAccountIds: string[],
  before: Date,
): Promise<number> {
  if (assetAccountIds.length === 0) return 0;
  const [deb, cre] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        debitAccountId: { in: assetAccountIds },
        date: { lt: before },
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        creditAccountId: { in: assetAccountIds },
        date: { lt: before },
      },
      _sum: { amount: true },
    }),
  ]);
  return Number(deb._sum.amount ?? 0) - Number(cre._sum.amount ?? 0);
}

/**
 * Compute the canonical data payload for a finance-summary PDF.
 *
 * `period` is `"YYYY-MM"`. The function does not gate by RBAC — that's
 * the route's responsibility.
 */
export async function computeFinanceSummaryData(
  buildingId: string,
  period: string,
): Promise<FinanceSummaryData> {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Invalid period "${period}", expected YYYY-MM`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in period "${period}"`);
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true },
  });
  if (!building) throw new Error(`Building ${buildingId} not found`);

  const [assetAccounts, periodEntries, last6Entries] = await Promise.all([
    prisma.account.findMany({
      where: { buildingId, type: "ASSET" },
      select: { id: true },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        date: { gte: periodStart, lt: periodEnd },
        OR: [
          { debitAccount: { buildingId } },
          { creditAccount: { buildingId } },
        ],
      },
      include: {
        debitAccount: { select: { name: true, type: true } },
        creditAccount: { select: { name: true, type: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(year, month - 6, 1)),
          lt: periodEnd,
        },
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
  ]);

  const assetIds = assetAccounts.map((a) => a.id);
  const [openingBalance, closingBalance] = await Promise.all([
    sumAssetBalanceBefore(assetIds, periodStart),
    sumAssetBalanceBefore(assetIds, periodEnd),
  ]);

  // Period income/expense + categorisation.
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  let totalIncome = 0;
  let totalExpenses = 0;

  type Enriched = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    kind: "income" | "expense";
    category: string;
  };
  const enriched: Enriched[] = [];

  for (const e of periodEntries) {
    const amt = Number(e.amount);
    if (e.creditAccount.type === "INCOME") {
      const cat = categorizeAccount(e.creditAccount.name);
      incomeMap.set(cat, (incomeMap.get(cat) ?? 0) + amt);
      totalIncome += amt;
      enriched.push({
        id: e.id,
        date: e.date,
        description: e.description,
        amount: amt,
        kind: "income",
        category: cat,
      });
    } else if (e.debitAccount.type === "EXPENSE") {
      const cat = categorizeAccount(e.debitAccount.name);
      expenseMap.set(cat, (expenseMap.get(cat) ?? 0) + amt);
      totalExpenses += amt;
      enriched.push({
        id: e.id,
        date: e.date,
        description: e.description,
        amount: amt,
        kind: "expense",
        category: cat,
      });
    }
  }

  const incomeByCategory = Array.from(incomeMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const expenseByCategory = Array.from(expenseMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Top 10 by absolute amount.
  const topEntries = enriched
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      description: e.description,
      amount: e.amount,
      kind: e.kind,
      category: e.category,
    }));

  // 6-month trailing trend.
  const trendBuckets = new Map<string, { income: number; expense: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    trendBuckets.set(key, { income: 0, expense: 0 });
  }
  for (const e of last6Entries) {
    const d = e.date;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = trendBuckets.get(key);
    if (!bucket) continue;
    const amt = Number(e.amount);
    if (
      e.creditAccount?.type === "INCOME" &&
      e.creditAccount.buildingId === buildingId
    ) {
      bucket.income += amt;
    } else if (
      e.debitAccount?.type === "EXPENSE" &&
      e.debitAccount.buildingId === buildingId
    ) {
      bucket.expense += amt;
    }
  }
  const monthlyTrend = Array.from(trendBuckets.entries()).map(
    ([key, v]) => {
      const [y, mm] = key.split("-").map(Number);
      return {
        label: `${MONTH_HU_ABBR[mm - 1]} ${String(y).slice(2)}`,
        income: v.income,
        expense: v.expense,
        net: v.income - v.expense,
      };
    },
  );

  return {
    buildingName: building.name,
    period: {
      year,
      month,
      label: `${year}. ${MONTH_HU[month - 1]}`,
      startISO: periodStart.toISOString(),
      endISO: periodEnd.toISOString(),
    },
    openingBalance,
    closingBalance,
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    incomeByCategory,
    expenseByCategory,
    topEntries,
    monthlyTrend,
  };
}
