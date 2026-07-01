import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MajorityType, CostAllocationBasis } from "@prisma/client";

const SHARE_EPS = 0.0001;

/**
 * GET /api/onboarding — building setup state for the onboarding wizard,
 * scoped to the active building. Basics + governance values plus the
 * derived progress signals (unit count, ownership share, SZMSZ docs,
 * member count) so the wizard can reflect completion without re-querying.
 */
export async function GET() {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "board.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { buildingId } = ctx;

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        zipCode: true,
        reserveTargetHUF: true,
        defaultMajority: true,
        costAllocationBasis: true,
        onboardingCompletedAt: true,
      },
    });
    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    // SZMSZ category — the seeded "SZMSZ és alapító okirat" (older buildings
    // may not have it; then szmszCategoryId is null and the step links to docs).
    const szmszCategory = await prisma.documentCategory.findFirst({
      where: { buildingId, name: { contains: "SZMSZ", mode: "insensitive" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    const [unitCount, shareAgg, szmszDocCount, memberCount] = await Promise.all([
      prisma.unit.count({ where: { buildingId } }),
      prisma.unit.aggregate({
        where: { buildingId },
        _sum: { ownershipShare: true },
      }),
      szmszCategory
        ? prisma.document.count({ where: { categoryId: szmszCategory.id } })
        : Promise.resolve(0),
      prisma.userBuilding.count({ where: { buildingId } }),
    ]);

    const ownershipShare = Number(shareAgg._sum.ownershipShare ?? 0);

    return NextResponse.json({
      building: {
        id: building.id,
        name: building.name,
        address: building.address,
        city: building.city,
        zipCode: building.zipCode,
        reserveTargetHUF: Number(building.reserveTargetHUF),
        defaultMajority: building.defaultMajority,
        costAllocationBasis: building.costAllocationBasis,
        onboardingCompletedAt:
          building.onboardingCompletedAt?.toISOString() ?? null,
      },
      progress: {
        unitCount,
        ownershipShare,
        sharesComplete: unitCount > 0 && Math.abs(ownershipShare - 1) <= SHARE_EPS,
        szmszDocCount,
        memberCount,
      },
      szmszCategoryId: szmszCategory?.id ?? null,
    });
  } catch (error) {
    console.error("Failed to load onboarding state:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/onboarding — save a wizard step for the active building.
 * `action: "basics"` updates name/address/city/zipCode;
 * `action: "governance"` updates reserve target, majority rule, cost basis.
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "board.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { buildingId } = ctx;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { action } = body as { action?: string };

    if (action === "basics") {
      const { name, address, city, zipCode } = body as Record<string, unknown>;
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      await prisma.building.update({
        where: { id: buildingId },
        data: {
          name: name.trim(),
          address: typeof address === "string" ? address.trim() : undefined,
          city: typeof city === "string" ? city.trim() : undefined,
          zipCode: typeof zipCode === "string" ? zipCode.trim() : undefined,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "governance") {
      const { reserveTargetHUF, defaultMajority, costAllocationBasis } =
        body as Record<string, unknown>;

      const data: {
        reserveTargetHUF?: bigint;
        defaultMajority?: MajorityType;
        costAllocationBasis?: CostAllocationBasis;
      } = {};

      if (reserveTargetHUF !== undefined) {
        const n = Number(reserveTargetHUF);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: "Invalid reserve target" },
            { status: 400 },
          );
        }
        data.reserveTargetHUF = BigInt(Math.round(n));
      }
      if (defaultMajority !== undefined) {
        if (!Object.values(MajorityType).includes(defaultMajority as MajorityType)) {
          return NextResponse.json(
            { error: "Invalid majority rule" },
            { status: 400 },
          );
        }
        data.defaultMajority = defaultMajority as MajorityType;
      }
      if (costAllocationBasis !== undefined) {
        if (
          !Object.values(CostAllocationBasis).includes(
            costAllocationBasis as CostAllocationBasis,
          )
        ) {
          return NextResponse.json(
            { error: "Invalid cost allocation basis" },
            { status: 400 },
          );
        }
        data.costAllocationBasis = costAllocationBasis as CostAllocationBasis;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }

      await prisma.building.update({ where: { id: buildingId }, data });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to save onboarding step:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
