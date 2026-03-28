import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const unitIdParam = searchParams.get("unitId") ?? undefined;
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    // Determine which unit to query
    let targetUnitId: string;
    if (isBoardPlus && unitIdParam) {
      // Verify unit belongs to this building
      const unit = await prisma.unit.findUnique({ where: { id: unitIdParam }, select: { buildingId: true } });
      if (!unit || unit.buildingId !== buildingId) {
        return NextResponse.json({ currentBalance: 0, nextDue: null, lastPayment: null });
      }
      targetUnitId = unitIdParam;
    } else {
      // Resident: get their first unit in this building
      const userUnit = await prisma.unitUser.findFirst({
        where: { userId, unit: { buildingId } },
        select: { unitId: true },
      });
      if (!userUnit) {
        return NextResponse.json({ currentBalance: 0, nextDue: null, lastPayment: null });
      }
      targetUnitId = userUnit.unitId;
    }

    // Current balance: sum of UNPAID + OVERDUE amounts
    const unpaidCharges = await prisma.monthlyCharge.findMany({
      where: {
        unitId: targetUnitId,
        status: { in: ["UNPAID", "OVERDUE"] },
      },
      select: { amount: true },
    });

    const currentBalance = unpaidCharges.reduce(
      (sum, c) => sum.add(c.amount),
      new Prisma.Decimal(0)
    );

    // Next due: earliest unpaid/overdue charge by month
    const nextDueCharge = await prisma.monthlyCharge.findFirst({
      where: {
        unitId: targetUnitId,
        status: { in: ["UNPAID", "OVERDUE"] },
      },
      orderBy: { month: "asc" },
      select: { amount: true, month: true },
    });

    // Last payment: most recent paid charge
    const lastPayment = await prisma.monthlyCharge.findFirst({
      where: {
        unitId: targetUnitId,
        status: "PAID",
      },
      orderBy: { paidAt: "desc" },
      select: { amount: true, paidAt: true },
    });

    return NextResponse.json({
      currentBalance,
      nextDue: nextDueCharge
        ? { amount: nextDueCharge.amount, month: nextDueCharge.month }
        : null,
      lastPayment: lastPayment
        ? { amount: lastPayment.amount, paidAt: lastPayment.paidAt }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch charge summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
