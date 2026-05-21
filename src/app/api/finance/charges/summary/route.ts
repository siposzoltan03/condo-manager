import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import {
  findUnitInBuilding,
  findFirstUserUnitId,
  getChargeSummaryForUnit,
} from "@/lib/finance-dal";

const EMPTY_SUMMARY = {
  currentBalance: 0,
  nextDue: null,
  lastPayment: null,
} as const;

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

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

    const { searchParams } = request.nextUrl;
    const unitIdParam = searchParams.get("unitId") ?? undefined;
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    // Resolve target unit. Board can scope by unitId; residents fall
    // back to their own first unit in the active building.
    let targetUnitId: string;
    if (isBoardPlus && unitIdParam) {
      const unit = await findUnitInBuilding(unitIdParam, buildingId);
      if (!unit) return NextResponse.json(EMPTY_SUMMARY);
      targetUnitId = unit.id;
    } else {
      const ownUnitId = await findFirstUserUnitId(userId, buildingId);
      if (!ownUnitId) return NextResponse.json(EMPTY_SUMMARY);
      targetUnitId = ownUnitId;
    }

    const { unpaid, nextDue, lastPayment } =
      await getChargeSummaryForUnit(targetUnitId);
    const currentBalance = unpaid.reduce(
      (sum, c) => sum.add(c.amount),
      new Prisma.Decimal(0),
    );

    return NextResponse.json({
      currentBalance,
      nextDue: nextDue
        ? { amount: nextDue.amount, month: nextDue.month }
        : null,
      lastPayment: lastPayment
        ? { amount: lastPayment.amount, paidAt: lastPayment.paidAt }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch charge summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
