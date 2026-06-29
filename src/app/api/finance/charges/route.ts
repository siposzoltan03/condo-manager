import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole } from "@/lib/rbac";
import { allows } from "@/lib/authz";
import {
  findUnitInBuilding,
  listBuildingUnitIds,
  listUserUnitIdsInBuilding,
  listChargesPaginated,
  findUnitIdsInBuilding,
  createMonthlyChargesBulk,
} from "@/lib/finance-dal";
import { chargesBulkCreated } from "@/lib/finance/events";

const EMPTY_LIST_PAGE = {
  charges: [],
  total: 0,
  totalPages: 0,
} as const;

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

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
    const year = searchParams.get("year") ?? undefined;
    const unitIdParam = searchParams.get("unitId") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit =
      isNaN(rawLimit) || rawLimit < 1 ? 1 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const isBoardPlus = allows(ctx, "view.building.finance");

    let targetUnitIds: string[];
    if (isBoardPlus && unitIdParam) {
      const unit = await findUnitInBuilding(unitIdParam, buildingId);
      if (!unit) {
        return NextResponse.json({ ...EMPTY_LIST_PAGE, page });
      }
      targetUnitIds = [unit.id];
    } else if (isBoardPlus) {
      targetUnitIds = await listBuildingUnitIds(buildingId);
    } else {
      targetUnitIds = await listUserUnitIdsInBuilding(userId, buildingId);
      if (targetUnitIds.length === 0) {
        return NextResponse.json({ ...EMPTY_LIST_PAGE, page });
      }
    }

    const { charges, total } = await listChargesPaginated({
      unitIds: targetUnitIds,
      year,
      skip,
      limit,
    });

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
      { status: 500 },
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
        return NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        );
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
        { status: 400 },
      );
    }

    for (const charge of charges) {
      if (!charge.unitId || !charge.month || charge.amount == null) {
        return NextResponse.json(
          { error: "Each charge must have unitId, month, and amount" },
          { status: 400 },
        );
      }
      if (!/^\d{4}-\d{2}$/.test(charge.month)) {
        return NextResponse.json(
          { error: `Invalid month format: ${charge.month}. Expected YYYY-MM` },
          { status: 400 },
        );
      }
      if (typeof charge.amount !== "number" || charge.amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive number" },
          { status: 400 },
        );
      }
      if (charge.amount > 10_000_000) {
        return NextResponse.json(
          { error: "Amount must not exceed 10,000,000" },
          { status: 400 },
        );
      }
    }

    const candidateIds = [
      ...new Set(charges.map((c: { unitId: string }) => c.unitId)),
    ] as string[];
    const validIds = await findUnitIdsInBuilding({
      buildingId,
      candidateIds,
    });
    const invalidUnits = candidateIds.filter((id) => !validIds.has(id));
    if (invalidUnits.length > 0) {
      return NextResponse.json(
        { error: `${invalidUnits.length} unit(s) not found in this building` },
        { status: 400 },
      );
    }

    const result = await createMonthlyChargesBulk(charges);

    await chargesBulkCreated({
      createdByUserId: userId,
      buildingId,
      count: result.count,
      charges,
    });

    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch (error) {
    console.error("Failed to create charges:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
