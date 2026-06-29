"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { allows } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { BuildingRole, UnitRelationship } from "@prisma/client";
import { hashPassword } from "@/lib/password";

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
  /// Phase 5 — Tht. § 22(2). Admins capturing a TENANT must record
  /// explicit consent before storing phone/email. Ignored for OWNER.
  contactConsent?: boolean;
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

    const { email, name, role, unitId, temporaryPassword, isPrimaryContact, relationship, contactConsent } = input;

    if (!email || !name || !role || !unitId || !temporaryPassword) {
      return { error: "Missing required fields: email, name, role, unitId, temporaryPassword" };
    }

    if (!Object.values(BuildingRole).includes(role as BuildingRole)) {
      return { error: "Invalid role" };
    }

    if (!allows({ role: activeRole }, "users.assignRole", { targetRole: role as BuildingRole })) {
      return { error: "Only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN roles" };
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.buildingId !== buildingId) {
      return { error: "Unit not found" };
    }

    const passwordHash = await hashPassword(temporaryPassword);

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

      const isTenant = unitRelationship === UnitRelationship.TENANT;
      await tx.unitUser.create({
        data: {
          userId: targetUser.id,
          unitId,
          relationship: unitRelationship,
          isPrimaryContact: isPrimaryContact ?? false,
          contactConsentAt: isTenant && contactConsent ? new Date() : null,
          contactConsentMode: isTenant && contactConsent ? "explicit" : null,
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
      // Block changing TO or FROM an elevated role unless the actor may
      // assign that role (only SUPER_ADMIN may touch ADMIN/SUPER_ADMIN).
      if (
        !allows({ role: activeRole }, "users.assignRole", { targetRole: input.role as BuildingRole }) ||
        !allows({ role: activeRole }, "users.assignRole", { targetRole: userBuilding.role })
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = Object.values(BuildingRole);
const TRUTHY = new Set(["true", "yes", "1", "igen"]);

export async function importUsers(rows: ImportRow[]): Promise<ImportResultType> {
  try {
    const { userId: currentUserId, buildingId, role: activeRole } = await requireBuildingContext();
    await requireRole(activeRole, "ADMIN");

    // Build unit number → id map
    const units = await prisma.unit.findMany({
      where: { buildingId },
      select: { id: true, number: true },
    });
    const unitMap = new Map(units.map((u) => [u.number, u.id]));

    // Get existing building members
    const existingMembers = await prisma.userBuilding.findMany({
      where: { buildingId },
      include: { user: { select: { email: true } } },
    });
    const existingEmails = new Set(existingMembers.map((m) => m.user.email.toLowerCase()));

    const errors: { row: number; message: string }[] = [];
    const credentials: { email: string; temporaryPassword: string }[] = [];
    const seenEmails = new Set<string>();
    let createdCount = 0;

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowNum = batchStart + i + 2;

        const email = row.email?.trim()?.toLowerCase();
        const name = row.name?.trim();
        const role = row.role?.trim()?.toUpperCase();
        const unitNumber = row.unit_number?.trim();
        const isPrimaryContact = TRUTHY.has((row.primary_contact ?? "").trim().toLowerCase());
        const relationship = (row.relationship?.trim()?.toUpperCase() || "OWNER") as string;

        if (!email || !EMAIL_RE.test(email)) { errors.push({ row: rowNum, message: "Invalid email" }); continue; }
        if (seenEmails.has(email)) { errors.push({ row: rowNum, message: `Duplicate email ${email}` }); continue; }
        if (existingEmails.has(email)) { errors.push({ row: rowNum, message: `${email} already in building` }); continue; }
        if (!name) { errors.push({ row: rowNum, message: "Name is required" }); continue; }
        if (!role || !VALID_ROLES.includes(role as BuildingRole)) { errors.push({ row: rowNum, message: `Invalid role: ${role}` }); continue; }
        if (!unitNumber) { errors.push({ row: rowNum, message: "Unit number is required" }); continue; }
        const unitId = unitMap.get(unitNumber);
        if (!unitId) { errors.push({ row: rowNum, message: `Unit ${unitNumber} not found` }); continue; }

        // RBAC: only SUPER_ADMIN can assign ADMIN+
        if (!allows({ role: activeRole }, "users.assignRole", { targetRole: role as BuildingRole })) {
          errors.push({ row: rowNum, message: "Only SUPER_ADMIN can assign ADMIN roles" });
          continue;
        }

        const tempPassword = crypto.randomBytes(12).toString("base64url");

        try {
          const passwordHash = await hashPassword(tempPassword);

          await prisma.$transaction(async (tx) => {
            let user = await tx.user.findUnique({ where: { email } });
            if (!user) {
              user = await tx.user.create({ data: { email, name, passwordHash } });
            }

            await tx.userBuilding.create({
              data: { userId: user.id, buildingId, role: role as BuildingRole },
            });

            const unitRel = Object.values(UnitRelationship).includes(relationship as UnitRelationship)
              ? (relationship as UnitRelationship)
              : UnitRelationship.OWNER;

            if (isPrimaryContact) {
              await tx.unitUser.updateMany({
                where: { unitId, isPrimaryContact: true },
                data: { isPrimaryContact: false },
              });
            }

            await tx.unitUser.create({
              data: { userId: user.id, unitId, relationship: unitRel, isPrimaryContact },
            });
          });

          seenEmails.add(email);
          existingEmails.add(email);
          credentials.push({ email, temporaryPassword: tempPassword });
          createdCount++;
        } catch (err) {
          errors.push({ row: rowNum, message: err instanceof Error ? err.message : "Failed to create user" });
        }
      }
    }

    await createAuditLog({
      entityType: "User",
      entityId: "bulk-import",
      action: "CREATE",
      userId: currentUserId,
      newValue: { importedCount: createdCount, errorCount: errors.length },
    });

    revalidatePath("/users");
    return {
      created: createdCount,
      skipped: 0,
      errors,
      summary: { credentials },
    };
  } catch (error) {
    console.error("Failed to import users:", error);
    return { created: 0, skipped: 0, errors: [{ row: 0, message: error instanceof Error ? error.message : "Internal server error" }] };
  }
}
