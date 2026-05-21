import { prisma } from "@/lib/prisma";

export interface UtilityStatementData {
  buildingName: string;
  period: { year: number; month: number; label: string };
  /** Same period a year ago, surfaced for narrative reference. */
  prevPeriod: { year: number; month: number; label: string };
  /** Per-utility totals for the period. */
  utilities: {
    name: string;
    /** Total ledger cost for the period (Ft). */
    amount: number;
    /** Same line in the prior calendar month (for delta narrative). */
    prevAmount: number;
    /** Δ % vs prior month — null when prior=0 (no comparison possible). */
    deltaPct: number | null;
  }[];
  totalAmount: number;
  totalPrevAmount: number;
  /** Per-unit allocation if ownership shares are set; sorted by unit number. */
  perUnit: {
    unitNumber: string;
    ownerName: string;
    ownershipShare: number; // 0..1
    /** ownershipShare × totalAmount, rounded to whole Ft. */
    allocation: number;
  }[];
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

function isRezsi(accountName: string): boolean {
  return REZSI_KEYWORDS.some((k) => accountName.toLowerCase().includes(k));
}

/**
 * Compute the canonical data payload for a utility-statement (rezsicsökkentési
 * kimutatás) PDF. `period` is `"YYYY-MM"`.
 */
export async function computeUtilityStatementData(
  buildingId: string,
  period: string,
): Promise<UtilityStatementData> {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Invalid period "${period}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  const prevStart = new Date(Date.UTC(year, month - 2, 1));
  const prevEnd = periodStart;

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true },
  });
  if (!building) throw new Error(`Building ${buildingId} not found`);

  // Pull both periods in one query — easier to bucket post-hoc.
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      date: { gte: prevStart, lt: periodEnd },
      debitAccount: { buildingId, type: "EXPENSE" },
    },
    select: {
      date: true,
      amount: true,
      debitAccount: { select: { name: true } },
    },
  });

  const periodMap = new Map<string, number>();
  const prevMap = new Map<string, number>();
  for (const e of entries) {
    if (!isRezsi(e.debitAccount.name)) continue;
    const inPeriod = e.date >= periodStart && e.date < periodEnd;
    const target = inPeriod ? periodMap : prevMap;
    target.set(
      e.debitAccount.name,
      (target.get(e.debitAccount.name) ?? 0) + Number(e.amount),
    );
  }

  const allNames = new Set([...periodMap.keys(), ...prevMap.keys()]);
  const utilities = Array.from(allNames)
    .map((name) => {
      const amount = periodMap.get(name) ?? 0;
      const prevAmount = prevMap.get(name) ?? 0;
      const deltaPct =
        prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
      return { name, amount, prevAmount, deltaPct };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = utilities.reduce((s, u) => s + u.amount, 0);
  const totalPrevAmount = utilities.reduce((s, u) => s + u.prevAmount, 0);

  // Per-unit allocation by ownershipShare.
  const units = await prisma.unit.findMany({
    where: { buildingId },
    select: {
      number: true,
      ownershipShare: true,
      unitUsers: {
        where: { relationship: "OWNER" },
        select: { user: { select: { name: true } } },
      },
    },
  });
  const perUnit = units
    .map((u) => {
      const ownershipShare = Number(u.ownershipShare);
      const allocation = Math.round(ownershipShare * totalAmount);
      return {
        unitNumber: u.number,
        ownerName: u.unitUsers[0]?.user.name ?? "—",
        ownershipShare,
        allocation,
      };
    })
    .sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );

  // Prior month label (for the column header).
  const prevMonthIdx = month - 2; // 0-indexed of prior calendar month
  const prevYear = prevMonthIdx < 0 ? year - 1 : year;
  const prevMonthNorm = ((prevMonthIdx % 12) + 12) % 12;

  return {
    buildingName: building.name,
    period: {
      year,
      month,
      label: `${year}. ${MONTH_HU[month - 1]}`,
    },
    prevPeriod: {
      year: prevYear,
      month: prevMonthNorm + 1,
      label: `${prevYear}. ${MONTH_HU[prevMonthNorm]}`,
    },
    utilities,
    totalAmount,
    totalPrevAmount,
    perUnit,
  };
}
