/**
 * Seed mock ledger entries + a current-year budget for Duna Residence
 * (`seed_building_1`). Idempotent enough — re-running adds *more* mock
 * entries with timestamped descriptions, so use sparingly. Targets the
 * past 7 months (current month included) for the trend chart, with the
 * monthly common-charge income posted on the 1st of each month and
 * various expenses scattered across.
 *
 * Usage:
 *   npx tsx scripts/seed-finance-mock.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const BUILDING_ID = "seed_building_1";

interface AccountRef {
  id: string;
  name: string;
  type: string;
}

async function main() {
  const accounts = await prisma.account.findMany({
    where: { buildingId: BUILDING_ID },
    select: { id: true, name: true, type: true },
  });

  if (accounts.length === 0) {
    throw new Error(
      `No accounts found for building ${BUILDING_ID} — run npm run seed first.`,
    );
  }

  const byName = new Map<string, AccountRef>(
    accounts.map((a) => [a.name, a]),
  );

  const operating = byName.get("Current Fund");
  const reserve = byName.get("Reserve Fund");
  const commonCharges = byName.get("Common Charges");
  const otherIncome = byName.get("Other Income");
  const maintenance = byName.get("Maintenance");
  const utilities = byName.get("Utilities");
  const insurance = byName.get("Insurance");
  const reserveContrib = byName.get("Reserve Fund Contribution");
  const management = byName.get("Management Fees");
  const security = byName.get("Security");

  if (
    !operating ||
    !reserve ||
    !commonCharges ||
    !otherIncome ||
    !maintenance ||
    !utilities ||
    !insurance ||
    !reserveContrib ||
    !management ||
    !security
  ) {
    throw new Error("Missing one or more required accounts on the building.");
  }

  const board = await prisma.user.findFirst({
    where: { email: "board@condo.local" },
    select: { id: true },
  });
  if (!board) throw new Error("board@condo.local user not found");

  const now = new Date();
  // Start 7 months back so the 6-month trend has the prior month populated.
  // UTC-anchored so the entries land cleanly inside their intended month
  // when the report queries Date.UTC-bounded ranges.
  const startMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 7, 1),
  );

  // Build 8 monthly cycles of activity.
  const entries: Prisma.LedgerEntryCreateManyInput[] = [];
  for (let i = 0; i < 8; i++) {
    const monthStart = new Date(
      Date.UTC(
        startMonth.getUTCFullYear(),
        startMonth.getUTCMonth() + i,
        1,
      ),
    );
    const ymLabel = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

    // 1st: monthly common-charges income (debit Current Fund, credit Common Charges)
    entries.push({
      date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1)),
      debitAccountId: operating.id,
      creditAccountId: commonCharges.id,
      amount: new Prisma.Decimal(2_400_000),
      description: `Közös költség beszedése ${ymLabel}`,
      createdById: board.id,
    });

    // 3rd: utilities expense (debit Utilities, credit Current Fund)
    entries.push({
      date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 3)),
      debitAccountId: utilities.id,
      creditAccountId: operating.id,
      amount: new Prisma.Decimal(620_000 + i * 8_000),
      description: `Áram + víz + gáz közüzemi számla ${ymLabel}`,
      createdById: board.id,
    });

    // 7th: management fee
    entries.push({
      date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 7)),
      debitAccountId: management.id,
      creditAccountId: operating.id,
      amount: new Prisma.Decimal(180_000),
      description: `Közös képviselet havi díja ${ymLabel}`,
      createdById: board.id,
    });

    // 10th: security
    entries.push({
      date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 10)),
      debitAccountId: security.id,
      creditAccountId: operating.id,
      amount: new Prisma.Decimal(95_000),
      description: `Vagyonvédelmi szerződés ${ymLabel}`,
      createdById: board.id,
    });

    // 14th: maintenance — varies by month
    const maintCases = [
      { amt: 120_000, desc: "Lépcsőházi izzócsere és apró javítás" },
      { amt: 410_000, desc: "Lift éves szervize" },
      { amt: 75_000, desc: "Szelektív hulladékgyűjtő tisztítása" },
      { amt: 230_000, desc: "Kapucsengő-rendszer javítás" },
      { amt: 1_200_000, desc: "Tetőszigetelés részleges javítása" },
      { amt: 88_000, desc: "Kapuvasalat csere" },
      { amt: 350_000, desc: "Lépcsőházi festés" },
      { amt: 145_000, desc: "Kerti öntöző javítás" },
    ];
    const m = maintCases[i % maintCases.length];
    entries.push({
      date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 14)),
      debitAccountId: maintenance.id,
      creditAccountId: operating.id,
      amount: new Prisma.Decimal(m.amt),
      description: m.desc,
      createdById: board.id,
    });

    // 20th: insurance every 3rd month
    if (i % 3 === 0) {
      entries.push({
        date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 20)),
        debitAccountId: insurance.id,
        creditAccountId: operating.id,
        amount: new Prisma.Decimal(95_000),
        description: `Épületbiztosítás negyedéves díja`,
        createdById: board.id,
      });
    }

    // 25th: reserve fund contribution
    entries.push({
      date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 25)),
      debitAccountId: reserveContrib.id,
      creditAccountId: reserve.id,
      amount: new Prisma.Decimal(300_000),
      description: `Felújítási alap havi feltöltése ${ymLabel}`,
      createdById: board.id,
    });

    // 28th: occasional other income
    if (i % 4 === 1) {
      entries.push({
        date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 28)),
        debitAccountId: operating.id,
        creditAccountId: otherIncome.id,
        amount: new Prisma.Decimal(180_000),
        description: `Hirdetőtábla bérleti díj ${ymLabel}`,
        createdById: board.id,
      });
    }
  }

  await prisma.ledgerEntry.createMany({ data: entries });
  console.log(`Inserted ${entries.length} ledger entries.`);

  // Annual budget for the current year.
  const year = now.getFullYear();
  const budgetData: { accountId: string; planned: number }[] = [
    { accountId: maintenance.id, planned: 4_500_000 },
    { accountId: utilities.id, planned: 8_000_000 },
    { accountId: insurance.id, planned: 400_000 },
    { accountId: reserveContrib.id, planned: 3_600_000 },
    { accountId: management.id, planned: 2_160_000 },
    { accountId: security.id, planned: 1_140_000 },
  ];

  for (const b of budgetData) {
    await prisma.budget.upsert({
      where: { year_accountId: { year, accountId: b.accountId } },
      create: {
        year,
        accountId: b.accountId,
        plannedAmount: new Prisma.Decimal(b.planned),
      },
      update: {
        plannedAmount: new Prisma.Decimal(b.planned),
      },
    });
  }
  console.log(`Upserted ${budgetData.length} budget rows for ${year}.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
