"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { requireNotFrozen } from "@/lib/frozen-check";
import { requireFeature } from "@/lib/feature-gate";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface ImportRow {
  [key: string]: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  summary?: Record<string, unknown>;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function importCharges(rows: ImportRow[]): Promise<ImportResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "BOARD_MEMBER");
    await requireNotFrozen(buildingId);
    await requireFeature(buildingId, "finance");

    // Build unit number → id map
    const units = await prisma.unit.findMany({
      where: { buildingId },
      select: { id: true, number: true },
    });
    const unitMap = new Map(units.map((u) => [u.number, u.id]));

    const errors: { row: number; message: string }[] = [];
    const validData: { unitId: string; month: string; amount: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const unitNumber = row.unit_number?.trim();
      const month = row.month?.trim();
      const amountStr = row.amount?.trim();

      if (!unitNumber) { errors.push({ row: rowNum, message: "Unit number is required" }); continue; }
      const unitId = unitMap.get(unitNumber);
      if (!unitId) { errors.push({ row: rowNum, message: `Unit ${unitNumber} not found` }); continue; }

      if (!month || !MONTH_RE.test(month)) { errors.push({ row: rowNum, message: "Month must be YYYY-MM format" }); continue; }

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) { errors.push({ row: rowNum, message: "Amount must be a positive number" }); continue; }

      validData.push({ unitId, month, amount });
    }

    if (validData.length === 0) {
      return { created: 0, skipped: 0, errors };
    }

    const result = await prisma.monthlyCharge.createMany({
      data: validData.map((d) => ({
        unitId: d.unitId,
        month: d.month,
        amount: new Prisma.Decimal(d.amount),
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      entityType: "MonthlyCharge",
      entityId: "bulk-import",
      action: "CREATE",
      userId,
      buildingId,
      newValue: { importedCount: result.count, errorCount: errors.length },
    });

    revalidatePath("/finance");
    return {
      created: result.count,
      skipped: validData.length - result.count,
      errors,
    };
  } catch (error) {
    console.error("Failed to import charges:", error);
    return { created: 0, skipped: 0, errors: [{ row: 0, message: error instanceof Error ? error.message : "Internal server error" }] };
  }
}

const VALID_ACCOUNT_TYPES = ["ASSET", "LIABILITY", "INCOME", "EXPENSE"];

export async function importAccounts(rows: ImportRow[]): Promise<ImportResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "ADMIN");
    await requireFeature(buildingId, "finance");

    // Get existing accounts
    const existing = await prisma.account.findMany({
      where: { buildingId },
      select: { id: true, name: true },
    });
    const existingNames = new Map(existing.map((a) => [a.name.toLowerCase(), a.id]));

    const errors: { row: number; message: string }[] = [];
    const validData: { name: string; type: string; parentName: string | null }[] = [];
    const seenNames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = row.account_name?.trim();
      const type = row.account_type?.trim()?.toUpperCase();
      const parentName = row.parent_account?.trim() || null;

      if (!name) { errors.push({ row: rowNum, message: "Account name is required" }); continue; }
      if (existingNames.has(name.toLowerCase())) { errors.push({ row: rowNum, message: `Account "${name}" already exists` }); continue; }
      if (seenNames.has(name.toLowerCase())) { errors.push({ row: rowNum, message: `Duplicate account "${name}" in file` }); continue; }
      if (!type || !VALID_ACCOUNT_TYPES.includes(type)) { errors.push({ row: rowNum, message: `Type must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}` }); continue; }

      seenNames.add(name.toLowerCase());
      validData.push({ name, type, parentName });
    }

    if (validData.length === 0) {
      return { created: 0, skipped: 0, errors };
    }

    // Two-pass creation: first create all accounts, then link parents
    const createdAccounts = await prisma.$transaction(async (tx) => {
      // Pass 1: create all without parents
      const created = [];
      for (const d of validData) {
        const account = await tx.account.create({
          data: {
            name: d.name,
            type: d.type as never,
            building: { connect: { id: buildingId } },
          },
        });
        created.push({ ...account, parentName: d.parentName });
      }

      // Pass 2: link parents
      const nameToId = new Map([
        ...existingNames.entries(),
        ...created.map((a) => [a.name.toLowerCase(), a.id] as const),
      ]);

      for (const acc of created) {
        if (acc.parentName) {
          const parentId = nameToId.get(acc.parentName.toLowerCase());
          if (parentId) {
            await tx.account.update({
              where: { id: acc.id },
              data: { parentId },
            });
          }
        }
      }

      return created;
    });

    await createAuditLog({
      entityType: "Account",
      entityId: "bulk-import",
      action: "CREATE",
      userId,
      buildingId,
      newValue: { importedCount: createdAccounts.length, errorCount: errors.length },
    });

    revalidatePath("/finance");
    return {
      created: createdAccounts.length,
      skipped: 0,
      errors,
    };
  } catch (error) {
    console.error("Failed to import accounts:", error);
    return { created: 0, skipped: 0, errors: [{ row: 0, message: error instanceof Error ? error.message : "Internal server error" }] };
  }
}
