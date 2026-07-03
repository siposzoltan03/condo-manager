"use server";

import { revalidatePath } from "next/cache";
import type { SpecialRightKind } from "@prisma/client";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";
import { prisma } from "@/lib/prisma";

interface ActionResult {
  success?: boolean;
  error?: string;
}

const KINDS: SpecialRightKind[] = [
  "EXCLUSIVE_USE",
  "PRE_EMPTION",
  "PARKING",
  "STORAGE",
  "OTHER",
];

/**
 * Manually add a special right — for grants that arise after the founding deed
 * (e.g. a later közgyűlési határozat) with no document to auto-extract from.
 * units.manage-gated + audited. No sourceVersion (manual).
 */
export async function createSpecialRight(input: {
  kind: string;
  description: string;
  unitId?: string | null;
  location?: string | null;
  areaSize?: number | null;
}): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    requireCapability(ctx, "units.manage");
    await requireNotFrozen(ctx.buildingId);

    const kind = input.kind as SpecialRightKind;
    if (!KINDS.includes(kind)) return { error: "Invalid right kind." };
    const description = input.description?.trim();
    if (!description) return { error: "A description is required." };

    // If a unit is specified, it must belong to this building.
    let unitId: string | null = null;
    if (input.unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: input.unitId, buildingId: ctx.buildingId },
        select: { id: true },
      });
      if (!unit) return { error: "Unit not found in this building." };
      unitId = unit.id;
    }

    const right = await prisma.specialRight.create({
      data: {
        buildingId: ctx.buildingId,
        unitId,
        kind,
        description: description.slice(0, 2000),
        location: input.location?.trim() || null,
        areaSize:
          typeof input.areaSize === "number" && Number.isFinite(input.areaSize)
            ? input.areaSize
            : null,
      },
    });
    await createAuditLog({
      entityType: "SpecialRight",
      entityId: right.id,
      action: "CREATE",
      userId: ctx.userId,
      buildingId: ctx.buildingId,
      newValue: { kind, unitId, manual: true },
    });
    revalidatePath("/units");
    return { success: true };
  } catch (e) {
    if (e instanceof FrozenBuildingError) return { error: e.message };
    console.error("createSpecialRight failed:", e);
    return { error: e instanceof Error ? e.message : "Internal error" };
  }
}

/** Remove a special right. units.manage-gated + audited. */
export async function deleteSpecialRight(input: { id: string }): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    requireCapability(ctx, "units.manage");
    await requireNotFrozen(ctx.buildingId);

    const right = await prisma.specialRight.findUnique({
      where: { id: input.id },
      select: { id: true, buildingId: true, kind: true },
    });
    if (!right || right.buildingId !== ctx.buildingId) {
      return { error: "Special right not found." };
    }

    await prisma.specialRight.delete({ where: { id: right.id } });
    await createAuditLog({
      entityType: "SpecialRight",
      entityId: right.id,
      action: "DELETE",
      userId: ctx.userId,
      buildingId: ctx.buildingId,
      oldValue: { kind: right.kind },
    });
    revalidatePath("/units");
    return { success: true };
  } catch (e) {
    if (e instanceof FrozenBuildingError) return { error: e.message };
    console.error("deleteSpecialRight failed:", e);
    return { error: e instanceof Error ? e.message : "Internal error" };
  }
}
