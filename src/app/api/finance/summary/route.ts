import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const currentYear = new Date().getFullYear();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam ? new Date(fromParam) : new Date(`${currentYear}-01-01`);
    const to = toParam ? new Date(toParam) : new Date(`${currentYear}-12-31T23:59:59.999Z`);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for 'from' or 'to'" },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        { error: "'from' date must not be after 'to' date" },
        { status: 400 }
      );
    }

    const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > fiveYearsMs) {
      return NextResponse.json(
        { error: "Date range must not exceed 5 years" },
        { status: 400 }
      );
    }

    const dateFilter = { gte: from, lte: to };

    // Get all accounts for this building
    const accounts = await prisma.account.findMany({
      where: { buildingId },
      select: { id: true, type: true },
    });

    const assetIds = accounts.filter((a) => a.type === "ASSET").map((a) => a.id);
    const incomeIds = accounts.filter((a) => a.type === "INCOME").map((a) => a.id);
    const expenseIds = accounts.filter((a) => a.type === "EXPENSE").map((a) => a.id);

    // Calculate income: credit entries to INCOME accounts
    const incomeCredits = await prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        date: dateFilter,
        creditAccountId: { in: incomeIds },
      },
    });

    // Calculate expenses: debit entries to EXPENSE accounts
    const expenseDebits = await prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        date: dateFilter,
        debitAccountId: { in: expenseIds },
      },
    });

    // Split ASSET accounts into current fund vs reserve fund
    // Convention: accounts with "reserve" in name go to reserve fund
    const reserveAccounts = await prisma.account.findMany({
      where: { type: "ASSET", buildingId, name: { contains: "reserve", mode: "insensitive" } },
      select: { id: true },
    });
    const reserveIds = reserveAccounts.map((a) => a.id);
    const currentFundIds = assetIds.filter((id) => !reserveIds.includes(id));

    const [currentDebits, currentCredits, reserveDebits, reserveCredits] =
      await Promise.all([
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

    const toNumber = (d: Prisma.Decimal | null): number =>
      d ? parseFloat(d.toString()) : 0;

    const currentFundBalance =
      toNumber(currentDebits._sum.amount) - toNumber(currentCredits._sum.amount);
    const reserveFundBalance =
      toNumber(reserveDebits._sum.amount) - toNumber(reserveCredits._sum.amount);
    const totalIncome = toNumber(incomeCredits._sum.amount);
    const totalExpenses = toNumber(expenseDebits._sum.amount);

    return NextResponse.json({
      currentFundBalance,
      reserveFundBalance,
      totalIncome,
      totalExpenses,
      period: { from: from.toISOString(), to: to.toISOString() },
    });
  } catch (error) {
    console.error("Failed to fetch finance summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
