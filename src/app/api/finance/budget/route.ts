import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
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
    const rawYear = parseInt(searchParams.get("year") ?? String(currentYear), 10);
    const year = isNaN(rawYear) ? currentYear : rawYear;

    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    // Get all EXPENSE accounts with their budget for this year
    const expenseAccounts = await prisma.account.findMany({
      where: { type: "EXPENSE" },
      include: {
        budgets: {
          where: { year },
        },
      },
      orderBy: { name: "asc" },
    });

    // Get actual spending for each expense account (sum of debit entries in that year)
    const actualAmounts = await prisma.ledgerEntry.groupBy({
      by: ["debitAccountId"],
      _sum: { amount: true },
      where: {
        date: { gte: yearStart, lte: yearEnd },
        debitAccountId: {
          in: expenseAccounts.map((a) => a.id),
        },
      },
    });

    const actualMap = new Map<string, number>();
    for (const entry of actualAmounts) {
      actualMap.set(
        entry.debitAccountId,
        entry._sum.amount ? parseFloat(entry._sum.amount.toString()) : 0
      );
    }

    const items = expenseAccounts.map((account) => ({
      accountId: account.id,
      name: account.name,
      plannedAmount: account.budgets[0]
        ? parseFloat(account.budgets[0].plannedAmount.toString())
        : 0,
      actualAmount: actualMap.get(account.id) ?? 0,
    }));

    return NextResponse.json({ year, items });
  } catch (error) {
    console.error("Failed to fetch budget:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { year, items } = body;

    if (!year || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: year, items (non-empty array)" },
        { status: 400 }
      );
    }

    if (typeof year !== "number" || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "Year must be a number between 2000 and 2100" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.accountId || item.plannedAmount == null) {
        return NextResponse.json(
          { error: "Each item must have accountId and plannedAmount" },
          { status: 400 }
        );
      }
      if (typeof item.plannedAmount !== "number" || item.plannedAmount < 0) {
        return NextResponse.json(
          { error: "plannedAmount must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    // Verify all accounts exist and are EXPENSE type
    const accountIds = items.map((i: { accountId: string }) => i.accountId);
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, type: "EXPENSE" },
      select: { id: true },
    });

    const foundIds = new Set(accounts.map((a) => a.id));
    const missing = accountIds.filter((id: string) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Accounts not found or not EXPENSE type: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Upsert budget records in a transaction
    const result = await prisma.$transaction(
      items.map((item: { accountId: string; plannedAmount: number }) =>
        prisma.budget.upsert({
          where: {
            year_accountId: { year, accountId: item.accountId },
          },
          update: {
            plannedAmount: new Prisma.Decimal(item.plannedAmount),
          },
          create: {
            year,
            accountId: item.accountId,
            plannedAmount: new Prisma.Decimal(item.plannedAmount),
          },
        })
      )
    );

    await createAuditLog({
      entityType: "Budget",
      entityId: `year-${year}`,
      action: "UPDATE",
      userId: user.id,
      newValue: { year, itemCount: result.length, items },
    });

    return NextResponse.json({ year, updated: result.length }, { status: 200 });
  } catch (error) {
    console.error("Failed to update budget:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
