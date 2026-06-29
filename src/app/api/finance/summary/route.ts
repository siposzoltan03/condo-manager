import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { Prisma } from "@prisma/client";
import { getBuildingFinancialSummary } from "@/lib/finance-dal";

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

const toNumber = (d: Prisma.Decimal | null): number =>
  d ? parseFloat(d.toString()) : 0;

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        );
      }
      throw err;
    }

    if (!allows(ctx, "view.building.finance")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const currentYear = new Date().getFullYear();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam
      ? new Date(fromParam)
      : new Date(`${currentYear}-01-01`);
    const to = toParam
      ? new Date(toParam)
      : new Date(`${currentYear}-12-31T23:59:59.999Z`);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for 'from' or 'to'" },
        { status: 400 },
      );
    }
    if (from > to) {
      return NextResponse.json(
        { error: "'from' date must not be after 'to' date" },
        { status: 400 },
      );
    }
    if (to.getTime() - from.getTime() > FIVE_YEARS_MS) {
      return NextResponse.json(
        { error: "Date range must not exceed 5 years" },
        { status: 400 },
      );
    }

    const {
      incomeCredits,
      expenseDebits,
      currentDebits,
      currentCredits,
      reserveDebits,
      reserveCredits,
    } = await getBuildingFinancialSummary({ buildingId, from, to });

    return NextResponse.json({
      currentFundBalance:
        toNumber(currentDebits._sum.amount) -
        toNumber(currentCredits._sum.amount),
      reserveFundBalance:
        toNumber(reserveDebits._sum.amount) -
        toNumber(reserveCredits._sum.amount),
      totalIncome: toNumber(incomeCredits._sum.amount),
      totalExpenses: toNumber(expenseDebits._sum.amount),
      period: { from: from.toISOString(), to: to.toISOString() },
    });
  } catch (error) {
    console.error("Failed to fetch finance summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
