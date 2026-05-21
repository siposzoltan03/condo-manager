"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

interface ActionResult {
  success?: boolean;
  error?: string;
}

/**
 * Toggle a single board permission grant. Admin+ only. The catalog row is
 * looked up by stable key (e.g. "financial_full"), so callers don't need
 * the DB id.
 */
export async function updateBoardPermission(input: {
  userBuildingId: string;
  permissionKey: string;
  granted: boolean;
}): Promise<ActionResult> {
  try {
    const { userId, role } = await requireBuildingContext();
    if (!hasMinimumRole(role, "ADMIN")) {
      return { error: "Forbidden — admin only" };
    }

    const { userBuildingId, permissionKey, granted } = input;

    const ub = await prisma.userBuilding.findUnique({
      where: { id: userBuildingId },
      select: { id: true, buildingId: true, role: true },
    });
    if (!ub) {
      return { error: "Membership not found" };
    }

    // Verify the same building scope as the calling admin.
    const ctx = await requireBuildingContext();
    if (ub.buildingId !== ctx.buildingId) {
      return { error: "Membership not in active building" };
    }

    const permission = await prisma.boardPermission.findUnique({
      where: { key: permissionKey },
      select: { id: true, key: true },
    });
    if (!permission) {
      return { error: "Permission key not found" };
    }

    if (granted) {
      await prisma.userBuildingPermission.upsert({
        where: {
          userBuildingId_permissionId: {
            userBuildingId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { userBuildingId, permissionId: permission.id },
      });
    } else {
      await prisma.userBuildingPermission.deleteMany({
        where: { userBuildingId, permissionId: permission.id },
      });
    }

    await createAuditLog({
      entityType: "UserBuildingPermission",
      entityId: userBuildingId,
      action: "UPDATE",
      userId,
      buildingId: ub.buildingId,
      newValue: { permissionKey, granted },
    });

    revalidatePath("/residents");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update board permission:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}
