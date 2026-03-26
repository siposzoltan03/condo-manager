import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
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

    const dateFilter = { gte: from, lte: to };

    // Get all accounts for reference
    const accounts = await prisma.account.findMany({
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
      where: { type: "ASSET", name: { contains: "reserve", mode: "insensitive" } },
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
