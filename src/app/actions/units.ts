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

// ─── Bulk Import ─────────────────────────────────────────────────────────────

interface ImportRow {
  [key: string]: string;
}

interface ImportResultType {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  summary?: Record<string, unknown>;
}

export async function importUnits(rows: ImportRow[]): Promise<ImportResultType> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "ADMIN");
    await requireNotFrozen(buildingId);

    const { allowed, current, max } = await checkUnitLimit(buildingId);
    if (!allowed) {
      return { created: 0, skipped: 0, errors: [{ row: 0, message: `Unit limit reached (${current}/${max})` }] };
    }

    // Check capacity
    const remainingCapacity = max === -1 ? Infinity : max - current;
    if (rows.length > remainingCapacity) {
      return {
        created: 0,
        skipped: 0,
        errors: [{ row: 0, message: `Cannot import ${rows.length} units. Only ${remainingCapacity} slots available.` }],
      };
    }

    // Get existing unit numbers
    const existingUnits = await prisma.unit.findMany({
      where: { buildingId },
      select: { number: true },
    });
    const existingNumbers = new Set(existingUnits.map((u) => u.number));

    const errors: { row: number; message: string }[] = [];
    const validData: { number: string; floor: number; size: number; ownershipShare: number }[] = [];
    const seenNumbers = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header

      const unitNumber = row.unit_number?.trim();
      const floorStr = row.floor?.trim();
      const sizeStr = row.size_sqm?.trim();
      const shareStr = row.ownership_share?.trim();

      if (!unitNumber) { errors.push({ row: rowNum, message: "Unit number is required" }); continue; }
      if (existingNumbers.has(unitNumber)) { errors.push({ row: rowNum, message: `Unit ${unitNumber} already exists` }); continue; }
      if (seenNumbers.has(unitNumber)) { errors.push({ row: rowNum, message: `Duplicate unit ${unitNumber} in file` }); continue; }

      const floor = parseInt(floorStr, 10);
      if (isNaN(floor)) { errors.push({ row: rowNum, message: "Invalid floor number" }); continue; }

      const size = parseFloat(sizeStr);
      if (isNaN(size) || size <= 0) { errors.push({ row: rowNum, message: "Invalid size" }); continue; }

      const share = parseFloat(shareStr);
      if (isNaN(share) || share < 0 || share > 1) { errors.push({ row: rowNum, message: "Ownership share must be between 0 and 1" }); continue; }

      seenNumbers.add(unitNumber);
      validData.push({ number: unitNumber, floor, size, ownershipShare: share });
    }

    if (validData.length === 0) {
      return { created: 0, skipped: rows.length - errors.length, errors };
    }

    // Batch create
    const created = await prisma.unit.createMany({
      data: validData.map((d) => ({
        number: d.number,
        floor: d.floor,
        size: new Prisma.Decimal(d.size),
        ownershipShare: new Prisma.Decimal(d.ownershipShare),
        buildingId,
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      entityType: "Unit",
      entityId: "bulk-import",
      action: "CREATE",
      userId,
      newValue: {
        importedCount: created.count,
        errorCount: errors.length,
        totalOwnershipImported: validData.reduce((sum, d) => sum + d.ownershipShare, 0),
      },
    });

    revalidatePath("/units");

    return {
      created: created.count,
      skipped: rows.length - validData.length - errors.length,
      errors,
      summary: {
        totalOwnershipImported: validData.reduce((sum, d) => sum + d.ownershipShare, 0).toFixed(4),
      },
    };
  } catch (error) {
    console.error("Failed to import units:", error);
    return { created: 0, skipped: 0, errors: [{ row: 0, message: error instanceof Error ? error.message : "Internal server error" }] };
  }
}
