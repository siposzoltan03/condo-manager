import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";
import { Prisma } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    try {
      requireCapability(ctx, "units.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        unitUsers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!unit || unit.buildingId !== buildingId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: unit.id,
      number: unit.number,
      floor: unit.floor,
      size: Number(unit.size),
      ownershipShare: Number(unit.ownershipShare),
      users: unit.unitUsers.map((uu) => ({
        id: uu.user.id,
        name: uu.user.name,
        email: uu.user.email,
        relationship: uu.relationship,
        isPrimaryContact: uu.isPrimaryContact,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch unit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      requireCapability(ctx, "units.manage");
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

    const { id } = await context.params;

    const existing = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        floor: true,
        size: true,
        ownershipShare: true,
        buildingId: true,
      },
    });

    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const body = await request.json();
    const { number, floor, size, ownershipShare } = body;

    const updateData: Prisma.UnitUpdateInput = {};
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (number !== undefined) {
      oldValue.number = existing.number;
      newValue.number = String(number);
      updateData.number = String(number);
    }

    if (floor !== undefined) {
      oldValue.floor = existing.floor;
      newValue.floor = Number(floor);
      updateData.floor = Number(floor);
    }

    if (size !== undefined) {
      oldValue.size = Number(existing.size);
      newValue.size = Number(size);
      updateData.size = new Prisma.Decimal(Number(size));
    }

    if (ownershipShare !== undefined) {
      const shareValue = Number(ownershipShare);
      if (shareValue < 0 || shareValue > 1) {
        return NextResponse.json(
          { error: "Ownership share must be between 0 and 1" },
          { status: 400 }
        );
      }
      oldValue.ownershipShare = Number(existing.ownershipShare);
      newValue.ownershipShare = shareValue;
      updateData.ownershipShare = new Prisma.Decimal(shareValue);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    try {
      const updated = await prisma.unit.update({
        where: { id },
        data: updateData,
      });

      await createAuditLog({
        entityType: "Unit",
        entityId: id,
        action: "UPDATE",
        userId,
      buildingId,
        oldValue,
        newValue,
      });

      return NextResponse.json({
        ...updated,
        size: Number(updated.size),
        ownershipShare: Number(updated.ownershipShare),
      });
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
    console.error("Failed to update unit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      requireCapability(ctx, "units.manage");
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

    const { id } = await context.params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        floor: true,
        size: true,
        ownershipShare: true,
        buildingId: true,
        _count: {
          select: { unitUsers: true },
        },
        monthlyCharges: {
          where: { status: "UNPAID" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!unit || unit.buildingId !== buildingId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (unit._count.unitUsers > 0) {
      return NextResponse.json(
        { error: "Cannot delete: unit has assigned users. Reassign them first." },
        { status: 409 }
      );
    }

    if (unit.monthlyCharges.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete: unit has unpaid charges." },
        { status: 409 }
      );
    }

    await prisma.unit.delete({ where: { id } });

    await createAuditLog({
      entityType: "Unit",
      entityId: id,
      action: "DELETE",
      userId,
      buildingId,
      oldValue: {
        number: unit.number,
        floor: unit.floor,
        size: Number(unit.size),
        ownershipShare: Number(unit.ownershipShare),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
