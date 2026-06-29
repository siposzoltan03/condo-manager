import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { parseCsv } from "@/lib/finance/csv-import";
import {
  findAccountInBuilding,
  findUncategorizedAccountInBuilding,
  findFirstAccountOfTypeInBuilding,
  createLedgerEntriesBulk,
} from "@/lib/finance-dal";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function resolveDefaultAccounts(opts: {
  buildingId: string;
  debitAccountId: string | null | undefined;
  creditAccountId: string | null | undefined;
}): Promise<
  | { ok: true; debitId: string; creditId: string }
  | { ok: false; error: string }
> {
  let defaultDebitId = opts.debitAccountId ?? null;
  let defaultCreditId = opts.creditAccountId ?? null;

  if (!defaultDebitId || !defaultCreditId) {
    const uncategorized = await findUncategorizedAccountInBuilding(
      opts.buildingId,
    );
    if (!defaultDebitId) {
      if (uncategorized) {
        defaultDebitId = uncategorized.id;
      } else {
        const fallback = await findFirstAccountOfTypeInBuilding(
          opts.buildingId,
          "EXPENSE",
        );
        if (!fallback)
          return {
            ok: false,
            error: "No EXPENSE account found for default debit mapping",
          };
        defaultDebitId = fallback.id;
      }
    }
    if (!defaultCreditId) {
      if (uncategorized && uncategorized.id !== defaultDebitId) {
        defaultCreditId = uncategorized.id;
      } else {
        const fallback = await findFirstAccountOfTypeInBuilding(
          opts.buildingId,
          "ASSET",
        );
        if (!fallback)
          return {
            ok: false,
            error: "No ASSET account found for default credit mapping",
          };
        defaultCreditId = fallback.id;
      }
    }
  }

  if (defaultDebitId === defaultCreditId) {
    return { ok: false, error: "Debit and credit accounts must be different" };
  }

  const [debit, credit] = await Promise.all([
    findAccountInBuilding(defaultDebitId, opts.buildingId),
    findAccountInBuilding(defaultCreditId, opts.buildingId),
  ]);
  if (!debit) return { ok: false, error: "Specified debit account not found" };
  if (!credit)
    return { ok: false, error: "Specified credit account not found" };

  return { ok: true, debitId: defaultDebitId, creditId: defaultCreditId };
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        );
      }
      throw err;
    }

    if (!allows(ctx, "manage.budget")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { csv, debitAccountId, creditAccountId } = body;

    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "Missing required field: csv (string)" },
        { status: 400 },
      );
    }
    if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: "CSV payload too large (max 2 MB)" },
        { status: 413 },
      );
    }

    const { validRows, errors } = parseCsv(csv);
    if (validRows.length === 0) {
      return NextResponse.json(
        {
          created: 0,
          errors: errors.length > 0 ? errors : ["No valid rows found"],
        },
        { status: 200 },
      );
    }

    const resolved = await resolveDefaultAccounts({
      buildingId,
      debitAccountId,
      creditAccountId,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const entries = validRows.map((row) => {
      const amount = row.debit ?? row.credit!;
      const isDebit = row.debit !== null && row.debit > 0;
      return {
        date: new Date(row.date),
        debitAccountId: isDebit ? resolved.debitId : resolved.creditId,
        creditAccountId: isDebit ? resolved.creditId : resolved.debitId,
        amount: new Prisma.Decimal(amount),
        description: row.description,
        createdById: userId,
      };
    });

    const result = await createLedgerEntriesBulk(entries);

    await createAuditLog({
      entityType: "LedgerEntry",
      entityId: "csv-import",
      action: "CREATE",
      userId,
      buildingId,
      newValue: { importedCount: result.length, rowErrors: errors.length },
    });

    return NextResponse.json({ created: result.length, errors });
  } catch (error) {
    console.error("Failed to import CSV:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
