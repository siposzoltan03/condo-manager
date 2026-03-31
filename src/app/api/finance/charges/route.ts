import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { searchParams } = request.nextUrl;
    const year = searchParams.get("year") ?? undefined;
    const unitIdParam = searchParams.get("unitId") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 1 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    // Determine which unit(s) to query
    let targetUnitIds: string[];
    if (isBoardPlus && unitIdParam) {
      // Verify unit belongs to this building
      const unit = await prisma.unit.findUnique({ where: { id: unitIdParam }, select: { buildingId: true } });
      if (!unit || unit.buildingId !== buildingId) {
        return NextResponse.json({ charges: [], total: 0, page, totalPages: 0 });
      }
      targetUnitIds = [unitIdParam];
    } else if (isBoardPlus) {
      // Board+ without unitId filter: show all building units
      const buildingUnits = await prisma.unit.findMany({
        where: { buildingId },
        select: { id: true },
      });
      targetUnitIds = buildingUnits.map((u) => u.id);
    } else {
      // Residents: show charges for their units in this building
      const userUnits = await prisma.unitUser.findMany({
        where: { userId, unit: { buildingId } },
        select: { unitId: true },
      });
      targetUnitIds = userUnits.map((u) => u.unitId);
      if (targetUnitIds.length === 0) {
        return NextResponse.json({ charges: [], total: 0, page, totalPages: 0 });
      }
    }

    const where: Prisma.MonthlyChargeWhereInput = {
      unitId: { in: targetUnitIds },
    };

    // Filter by year (month field is "YYYY-MM")
    if (year && /^\d{4}$/.test(year)) {
      where.month = { startsWith: year };
    }

    const [charges, total] = await Promise.all([
      prisma.monthlyCharge.findMany({
        where,
        include: {
          unit: {
            select: { number: true },
          },
        },
        orderBy: { month: "desc" },
        skip,
        take: limit,
      }),
      prisma.monthlyCharge.count({ where }),
    ]);

    return NextResponse.json({
      charges,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch charges:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { charges } = body;

    if (!Array.isArray(charges) || charges.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: charges (non-empty array)" },
        { status: 400 }
      );
    }

    // Validate each charge entry
    for (const charge of charges) {
      if (!charge.unitId || !charge.month || charge.amount == null) {
        return NextResponse.json(
          { error: "Each charge must have unitId, month, and amount" },
          { status: 400 }
        );
      }
      if (!/^\d{4}-\d{2}$/.test(charge.month)) {
        return NextResponse.json(
          { error: `Invalid month format: ${charge.month}. Expected YYYY-MM` },
          { status: 400 }
        );
      }
      if (typeof charge.amount !== "number" || charge.amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive number" },
          { status: 400 }
        );
      }
      if (charge.amount > 10_000_000) {
        return NextResponse.json(
          { error: "Amount must not exceed 10,000,000" },
          { status: 400 }
        );
      }
    }

    // Verify all units belong to this building
    const chargeUnitIds = [...new Set(charges.map((c: { unitId: string }) => c.unitId))];
    const validUnits = await prisma.unit.findMany({
      where: { id: { in: chargeUnitIds as string[] }, buildingId },
      select: { id: true },
    });
    const validUnitIds = new Set(validUnits.map((u) => u.id));
    const invalidUnits = (chargeUnitIds as string[]).filter((id) => !validUnitIds.has(id));
    if (invalidUnits.length > 0) {
      return NextResponse.json(
        { error: `${invalidUnits.length} unit(s) not found in this building` },
        { status: 400 }
      );
    }

    const result = await prisma.monthlyCharge.createMany({
      data: charges.map((c: { unitId: string; month: string; amount: number }) => ({
        unitId: c.unitId,
        month: c.month,
        amount: new Prisma.Decimal(c.amount),
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      entityType: "MonthlyCharge",
      entityId: "bulk",
      action: "CREATE",
      userId,
      newValue: { count: result.count, charges },
    });

    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch (error) {
    console.error("Failed to create charges:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
