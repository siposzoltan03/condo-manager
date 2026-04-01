"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { BuildingRole, UnitRelationship } from "@prisma/client";
import bcrypt from "bcryptjs";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface CreateUserInput {
  email: string;
  name: string;
  role: string;
  unitId: string;
  temporaryPassword: string;
  isPrimaryContact?: boolean;
  relationship?: string;
}

interface UpdateUserInput {
  role?: string;
  unitId?: string;
  isPrimaryContact?: boolean;
  relationship?: string;
  isActive?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  try {
    const { userId: currentUserId, buildingId, role: activeRole } = await requireBuildingContext();
    await requireRole(activeRole, "ADMIN");

    const { email, name, role, unitId, temporaryPassword, isPrimaryContact, relationship } = input;

    if (!email || !name || !role || !unitId || !temporaryPassword) {
      return { error: "Missing required fields: email, name, role, unitId, temporaryPassword" };
    }

    if (!Object.values(BuildingRole).includes(role as BuildingRole)) {
      return { error: "Invalid role" };
    }

    if (
      (role === "SUPER_ADMIN" || role === "ADMIN") &&
      !hasMinimumRole(activeRole, "SUPER_ADMIN")
    ) {
      return { error: "Only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN roles" };
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.buildingId !== buildingId) {
      return { error: "Unit not found" };
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.userBuilding.findFirst({
        where: { userId: existingUser.id, buildingId },
      });
      if (existingMembership) {
        return { error: "User is already a member of this building" };
      }
    }

    if (isPrimaryContact) {
      await prisma.unitUser.updateMany({
        where: { unitId, isPrimaryContact: true },
        data: { isPrimaryContact: false },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetUser = existingUser;
      if (!targetUser) {
        targetUser = await tx.user.create({
          data: { email, name, passwordHash },
        });
      }

      await tx.userBuilding.create({
        data: {
          userId: targetUser.id,
          buildingId,
          role: role as BuildingRole,
        },
      });

      const unitRelationship =
        relationship && Object.values(UnitRelationship).includes(relationship as UnitRelationship)
          ? (relationship as UnitRelationship)
          : UnitRelationship.OWNER;

      await tx.unitUser.create({
        data: {
          userId: targetUser.id,
          unitId,
          relationship: unitRelationship,
          isPrimaryContact: isPrimaryContact ?? false,
        },
      });

      return targetUser;
    });

    await createAuditLog({
      entityType: "User",
      entityId: result.id,
      action: "CREATE",
      userId: currentUserId,
      newValue: { email, name, role, unitId, buildingId, isPrimaryContact: isPrimaryContact ?? false },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to create user:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<ActionResult> {
  try {
    const { userId: currentUserId, buildingId, role: activeRole } = await requireBuildingContext();
    await requireRole(activeRole, "ADMIN");

    const userBuilding = await prisma.userBuilding.findFirst({
      where: { userId: id, buildingId },
      include: { user: { select: { id: true, name: true, isActive: true } } },
    });

    if (!userBuilding) {
      return { error: "User not found in this building" };
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    // Role update
    if (input.role !== undefined && input.role !== userBuilding.role) {
      if (!Object.values(BuildingRole).includes(input.role as BuildingRole)) {
        return { error: "Invalid role" };
      }
      if (
        (input.role === "SUPER_ADMIN" || input.role === "ADMIN" ||
         userBuilding.role === "SUPER_ADMIN" || userBuilding.role === "ADMIN") &&
        !hasMinimumRole(activeRole, "SUPER_ADMIN")
      ) {
        return { error: "Only SUPER_ADMIN can change ADMIN or SUPER_ADMIN roles" };
      }
      oldValue.role = userBuilding.role;
      newValue.role = input.role;
      await prisma.userBuilding.update({
        where: { id: userBuilding.id },
        data: { role: input.role as BuildingRole },
      });
    }

    // Unit assignment
    if (input.unitId !== undefined) {
      const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
      if (!unit || unit.buildingId !== buildingId) {
        return { error: "Unit not found" };
      }

      // Remove existing unit assignments in this building
      const existingUnitUsers = await prisma.unitUser.findMany({
        where: { userId: id, unit: { buildingId } },
      });
      if (existingUnitUsers.length > 0) {
        await prisma.unitUser.deleteMany({
          where: { id: { in: existingUnitUsers.map((uu) => uu.id) } },
        });
      }

      if (input.isPrimaryContact) {
        await prisma.unitUser.updateMany({
          where: { unitId: input.unitId, isPrimaryContact: true },
          data: { isPrimaryContact: false },
        });
      }

      const unitRelationship =
        input.relationship && Object.values(UnitRelationship).includes(input.relationship as UnitRelationship)
          ? (input.relationship as UnitRelationship)
          : UnitRelationship.OWNER;

      await prisma.unitUser.create({
        data: {
          userId: id,
          unitId: input.unitId,
          relationship: unitRelationship,
          isPrimaryContact: input.isPrimaryContact ?? false,
        },
      });

      newValue.unitId = input.unitId;
    }

    // Active status
    if (input.isActive !== undefined && input.isActive !== userBuilding.user.isActive) {
      oldValue.isActive = userBuilding.user.isActive;
      newValue.isActive = input.isActive;
      await prisma.user.update({
        where: { id },
        data: { isActive: input.isActive },
      });
    }

    if (Object.keys(newValue).length > 0) {
      await createAuditLog({
        entityType: "User",
        entityId: id,
        action: "UPDATE",
        userId: currentUserId,
        oldValue,
        newValue,
      });
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to update user:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export async function toggleUserActive(id: string): Promise<ActionResult> {
  try {
    const { userId: currentUserId, buildingId, role: activeRole } = await requireBuildingContext();
    await requireRole(activeRole, "ADMIN");

    const userBuilding = await prisma.userBuilding.findFirst({
      where: { userId: id, buildingId },
      include: { user: { select: { isActive: true } } },
    });

    if (!userBuilding) {
      return { error: "User not found in this building" };
    }

    const newActive = !userBuilding.user.isActive;
    await prisma.user.update({
      where: { id },
      data: { isActive: newActive },
    });

    await createAuditLog({
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      userId: currentUserId,
      oldValue: { isActive: userBuilding.user.isActive },
      newValue: { isActive: newActive },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle user active:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
