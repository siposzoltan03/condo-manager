import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";
import { checkUnitLimit } from "@/lib/plan-limits";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const units = await prisma.unit.findMany({
      where: { buildingId },
      select: {
        id: true,
        number: true,
        floor: true,
        size: true,
        ownershipShare: true,
        _count: {
          select: { unitUsers: true },
        },
        unitUsers: {
          where: { isPrimaryContact: true },
          select: {
            user: {
              select: { name: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    });

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true },
    });

    const totalOwnershipShare = units.reduce(
      (sum, u) => sum + Number(u.ownershipShare),
      0
    );

    const result = units.map((u) => ({
      id: u.id,
      number: u.number,
      floor: u.floor,
      size: Number(u.size),
      ownershipShare: Number(u.ownershipShare),
      residentCount: u._count.unitUsers,
      primaryContact: u.unitUsers[0]?.user?.name ?? null,
    }));

    return NextResponse.json({
      units: result,
      totalOwnershipShare,
      buildingName: building?.name ?? "",
    });
  } catch (error) {
    console.error("Failed to fetch units:", error);
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
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      await requireNotFrozen(buildingId);
    } catch (e) {
      if (e instanceof FrozenBuildingError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { allowed, current, max } = await checkUnitLimit(buildingId);
    if (!allowed) {
      return NextResponse.json(
        { error: `Unit limit reached (${current}/${max}). Upgrade your plan to add more units.` },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { number, floor, size, ownershipShare } = body;

    if (!number || floor === undefined || floor === null || !size || !ownershipShare) {
      return NextResponse.json(
        { error: "Missing required fields: number, floor, size, ownershipShare" },
        { status: 400 }
      );
    }

    const shareValue = Number(ownershipShare);
    if (shareValue < 0 || shareValue > 1) {
      return NextResponse.json(
        { error: "Ownership share must be between 0 and 1" },
        { status: 400 }
      );
    }

    try {
      const unit = await prisma.unit.create({
        data: {
          number: String(number),
          floor: Number(floor),
          size: new Prisma.Decimal(Number(size)),
          ownershipShare: new Prisma.Decimal(shareValue),
          building: { connect: { id: buildingId } },
        },
      });

      await createAuditLog({
        entityType: "Unit",
        entityId: unit.id,
        action: "CREATE",
        userId,
        newValue: {
          number: unit.number,
          floor: unit.floor,
          size: Number(unit.size),
          ownershipShare: Number(unit.ownershipShare),
        },
      });

      return NextResponse.json(
        {
          ...unit,
          size: Number(unit.size),
          ownershipShare: Number(unit.ownershipShare),
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A unit with this number already exists in this building" },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Failed to create unit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
