"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { requireNotFrozen } from "@/lib/frozen-check";
import { checkUnitLimit } from "@/lib/plan-limits";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface UnitInput {
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
}

export async function createUnit(input: UnitInput): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "ADMIN");
    await requireNotFrozen(buildingId);

    const { allowed, current, max } = await checkUnitLimit(buildingId);
    if (!allowed) {
      return { error: `Unit limit reached (${current}/${max}). Upgrade your plan to add more units.` };
    }

    const { number, floor, size, ownershipShare } = input;

    if (!number || floor === undefined || !size || !ownershipShare) {
      return { error: "Missing required fields: number, floor, size, ownershipShare" };
    }

    if (ownershipShare < 0 || ownershipShare > 1) {
      return { error: "Ownership share must be between 0 and 1" };
    }

    try {
      const unit = await prisma.unit.create({
        data: {
          number: String(number),
          floor: Number(floor),
          size: new Prisma.Decimal(Number(size)),
          ownershipShare: new Prisma.Decimal(ownershipShare),
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

      revalidatePath("/units");
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { error: "A unit with this number already exists in this building" };
      }
      throw err;
    }
  } catch (error) {
    console.error("Failed to create unit:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export async function updateUnit(id: string, input: Partial<UnitInput>): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "ADMIN");
    await requireNotFrozen(buildingId);

    const existing = await prisma.unit.findUnique({
      where: { id },
      select: { id: true, number: true, floor: true, size: true, ownershipShare: true, buildingId: true },
    });

    if (!existing || existing.buildingId !== buildingId) {
      return { error: "Unit not found" };
    }

    const updateData: Prisma.UnitUpdateInput = {};
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (input.number !== undefined) {
      oldValue.number = existing.number;
      newValue.number = String(input.number);
      updateData.number = String(input.number);
    }

    if (input.floor !== undefined) {
      oldValue.floor = existing.floor;
      newValue.floor = Number(input.floor);
      updateData.floor = Number(input.floor);
    }

    if (input.size !== undefined) {
      oldValue.size = Number(existing.size);
      newValue.size = Number(input.size);
      updateData.size = new Prisma.Decimal(Number(input.size));
    }

    if (input.ownershipShare !== undefined) {
      if (input.ownershipShare < 0 || input.ownershipShare > 1) {
        return { error: "Ownership share must be between 0 and 1" };
      }
      oldValue.ownershipShare = Number(existing.ownershipShare);
      newValue.ownershipShare = input.ownershipShare;
      updateData.ownershipShare = new Prisma.Decimal(input.ownershipShare);
    }

    if (Object.keys(updateData).length === 0) {
      return { error: "No fields to update" };
    }

    try {
      await prisma.unit.update({ where: { id }, data: updateData });

      await createAuditLog({
        entityType: "Unit",
        entityId: id,
        action: "UPDATE",
        userId,
        oldValue,
        newValue,
      });

      revalidatePath("/units");
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { error: "A unit with this number already exists in this building" };
      }
      throw err;
    }
  } catch (error) {
    console.error("Failed to update unit:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export async function deleteUnit(id: string): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "ADMIN");
    await requireNotFrozen(buildingId);

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        floor: true,
        size: true,
        ownershipShare: true,
        buildingId: true,
        _count: { select: { unitUsers: true } },
        monthlyCharges: { where: { status: "UNPAID" }, select: { id: true }, take: 1 },
      },
    });

    if (!unit || unit.buildingId !== buildingId) {
      return { error: "Unit not found" };
    }

    if (unit._count.unitUsers > 0) {
      return { error: "Cannot delete: unit has assigned users. Reassign them first." };
    }

    if (unit.monthlyCharges.length > 0) {
      return { error: "Cannot delete: unit has unpaid charges." };
    }

    await prisma.unit.delete({ where: { id } });

    await createAuditLog({
      entityType: "Unit",
      entityId: id,
      action: "DELETE",
      userId,
      oldValue: {
        number: unit.number,
        floor: unit.floor,
        size: Number(unit.size),
        ownershipShare: Number(unit.ownershipShare),
      },
    });

    revalidatePath("/units");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
