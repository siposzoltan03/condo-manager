import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { parseCsv } from "@/lib/finance/csv-import";

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { csv, debitAccountId, creditAccountId } = body;

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "Missing required field: csv (string)" },
        { status: 400 }
      );
    }

    if (Buffer.byteLength(csv, "utf8") > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "CSV payload too large (max 2 MB)" },
        { status: 413 }
      );
    }

    const { validRows, errors } = parseCsv(csv);

    if (validRows.length === 0) {
      return NextResponse.json(
        { created: 0, errors: errors.length > 0 ? errors : ["No valid rows found"] },
        { status: 200 }
      );
    }

    // Resolve default accounts for debit/credit
    // If user specifies account IDs, use those. Otherwise find "Uncategorized" or first available.
    let defaultDebitId = debitAccountId ?? null;
    let defaultCreditId = creditAccountId ?? null;

    if (!defaultDebitId || !defaultCreditId) {
      // Try to find an "Uncategorized" account for unspecified side
      const uncategorized = await prisma.account.findFirst({
        where: { name: { contains: "uncategorized", mode: "insensitive" }, buildingId },
      });

      if (!defaultDebitId) {
        if (uncategorized) {
          defaultDebitId = uncategorized.id;
        } else {
          // Fall back to first EXPENSE account
          const fallback = await prisma.account.findFirst({
            where: { type: "EXPENSE", buildingId },
            orderBy: { name: "asc" },
          });
          if (!fallback) {
            return NextResponse.json(
              { error: "No EXPENSE account found for default debit mapping" },
              { status: 400 }
            );
          }
          defaultDebitId = fallback.id;
        }
      }

      if (!defaultCreditId) {
        if (uncategorized && uncategorized.id !== defaultDebitId) {
          defaultCreditId = uncategorized.id;
        } else {
          // Fall back to first ASSET account
          const fallback = await prisma.account.findFirst({
            where: { type: "ASSET", buildingId },
            orderBy: { name: "asc" },
          });
          if (!fallback) {
            return NextResponse.json(
              { error: "No ASSET account found for default credit mapping" },
              { status: 400 }
            );
          }
          defaultCreditId = fallback.id;
        }
      }
    }

    // Validate debit and credit accounts are different
    if (defaultDebitId === defaultCreditId) {
      return NextResponse.json(
        { error: "Debit and credit accounts must be different" },
        { status: 400 }
      );
    }

    // Verify both default accounts exist
    const [debitAcct, creditAcct] = await Promise.all([
      prisma.account.findUnique({ where: { id: defaultDebitId } }),
      prisma.account.findUnique({ where: { id: defaultCreditId } }),
    ]);

    if (!debitAcct || debitAcct.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Specified debit account not found" },
        { status: 400 }
      );
    }
    if (!creditAcct || creditAcct.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Specified credit account not found" },
        { status: 400 }
      );
    }

    // Create ledger entries in a transaction
    const entries = validRows.map((row) => {
      // If row has debit amount: debit goes to default debit account, credit from default credit account
      // If row has credit amount: reversed — debit the credit account, credit the debit account
      const amount = row.debit ?? row.credit!;
      const isDebit = row.debit !== null && row.debit > 0;

      return {
        date: new Date(row.date),
        debitAccountId: isDebit ? defaultDebitId : defaultCreditId,
        creditAccountId: isDebit ? defaultCreditId : defaultDebitId,
        amount: new Prisma.Decimal(amount),
        description: row.description,
        createdById: userId,
      };
    });

    const result = await prisma.$transaction(
      entries.map((entry) =>
        prisma.ledgerEntry.create({ data: entry })
      )
    );

    await createAuditLog({
      entityType: "LedgerEntry",
      entityId: "csv-import",
      action: "CREATE",
      userId,
      newValue: { importedCount: result.length, rowErrors: errors.length },
    });

    return NextResponse.json({
      created: result.length,
      errors,
    });
  } catch (error) {
    console.error("Failed to import CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
