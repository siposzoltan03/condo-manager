import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import {
  getBuildingBudgetForYear,
  findExpenseAccountIdsInBuilding,
  upsertBudgetItems,
} from "@/lib/finance-dal";
import { budgetUpdated } from "@/lib/finance/events";

async function gateBoard() {
  const ctx = await requireBuildingContext();
  try {
    await requireFeature(ctx.buildingId, "finance");
  } catch (err) {
    if (err instanceof FeatureGateError) {
      return {
        ok: false as const,
        res: NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        ),
      };
    }
    throw err;
  }
  if (!hasMinimumRole(ctx.role, "BOARD_MEMBER")) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, ctx };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await gateBoard();
    if (!gate.ok) return gate.res;
    const { buildingId } = gate.ctx;

    const { searchParams } = request.nextUrl;
    const currentYear = new Date().getFullYear();
    const rawYear = parseInt(
      searchParams.get("year") ?? String(currentYear),
      10,
    );
    const year = isNaN(rawYear) ? currentYear : rawYear;

    const { expenseAccounts, actualAmounts } = await getBuildingBudgetForYear({
      buildingId,
      year,
    });

    const actualMap = new Map<string, number>();
    for (const entry of actualAmounts) {
      actualMap.set(
        entry.debitAccountId,
        entry._sum.amount ? parseFloat(entry._sum.amount.toString()) : 0,
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
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await gateBoard();
    if (!gate.ok) return gate.res;
    const { userId, buildingId } = gate.ctx;

    const body = await request.json();
    const { year, items } = body;

    if (!year || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: year, items (non-empty array)" },
        { status: 400 },
      );
    }
    if (typeof year !== "number" || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "Year must be a number between 2000 and 2100" },
        { status: 400 },
      );
    }
    for (const item of items) {
      if (!item.accountId || item.plannedAmount == null) {
        return NextResponse.json(
          { error: "Each item must have accountId and plannedAmount" },
          { status: 400 },
        );
      }
      if (typeof item.plannedAmount !== "number" || item.plannedAmount < 0) {
        return NextResponse.json(
          { error: "plannedAmount must be a non-negative number" },
          { status: 400 },
        );
      }
    }

    const accountIds = items.map((i: { accountId: string }) => i.accountId);
    const foundIds = await findExpenseAccountIdsInBuilding({
      buildingId,
      accountIds,
    });
    const missing = accountIds.filter((id: string) => !foundIds.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `${missing.length} account(s) not found or not EXPENSE type` },
        { status: 400 },
      );
    }

    const result = await upsertBudgetItems(year, items);

    await budgetUpdated({
      year,
      updatedByUserId: userId,
      buildingId,
      itemCount: result.length,
      items,
    });

    return NextResponse.json({ year, updated: result.length }, { status: 200 });
  } catch (error) {
    console.error("Failed to update budget:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
