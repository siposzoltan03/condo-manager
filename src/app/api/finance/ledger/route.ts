import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import {
  listAllBuildingAccountIds,
  listLedgerEntriesPaginated,
  findAccountInBuilding,
  createLedgerEntry,
} from "@/lib/finance-dal";
import { ledgerEntryCreated } from "@/lib/finance/events";

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

async function gateBoardFinance() {
  const ctx = await requireBuildingContext();
  try {
    await requireFeature(ctx.buildingId, "finance");
  } catch (err) {
    if (err instanceof FeatureGateError) {
      return {
        ok: false as const,
        res: NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        ),
      };
    }
    throw err;
  }
  if (!hasMinimumRole(ctx.role, "BOARD_MEMBER")) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, ctx };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await gateBoardFinance();
    if (!gate.ok) return gate.res;
    const { buildingId } = gate.ctx;

    const { searchParams } = request.nextUrl;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const accountId = searchParams.get("accountId") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit =
      isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    let from: Date | undefined;
    let to: Date | undefined;
    if (fromParam) {
      from = new Date(fromParam);
      if (isNaN(from.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format for 'from' or 'to'" },
          { status: 400 },
        );
      }
    }
    if (toParam) {
      to = new Date(toParam);
      if (isNaN(to.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format for 'from' or 'to'" },
          { status: 400 },
        );
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
        to.setHours(23, 59, 59, 999);
      }
    }
    if (from && to) {
      if (from > to) {
        return NextResponse.json(
          { error: "'from' date must not be after 'to' date" },
          { status: 400 },
        );
      }
      if (to.getTime() - from.getTime() > FIVE_YEARS_MS) {
        return NextResponse.json(
          { error: "Date range must not exceed 5 years" },
          { status: 400 },
        );
      }
    }

    const buildingAccountIds = await listAllBuildingAccountIds(buildingId);

    if (accountId && !buildingAccountIds.includes(accountId)) {
      return NextResponse.json({
        entries: [],
        total: 0,
        page,
        totalPages: 0,
      });
    }

    const { entries, total } = await listLedgerEntriesPaginated({
      buildingAccountIds,
      accountId,
      from,
      to,
      skip,
      limit,
    });

    return NextResponse.json({
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch ledger entries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await gateBoardFinance();
    if (!gate.ok) return gate.res;
    const { userId, buildingId } = gate.ctx;

    const body = await request.json();
    const { date, debitAccountId, creditAccountId, amount, description, receiptUrl } =
      body;

    if (!date || !debitAccountId || !creditAccountId || amount == null || !description) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: date, debitAccountId, creditAccountId, amount, description",
        },
        { status: 400 },
      );
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 },
      );
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 },
      );
    }
    if (amount > 10_000_000) {
      return NextResponse.json(
        { error: "Amount must not exceed 10,000,000" },
        { status: 400 },
      );
    }
    if (description.length > 500) {
      return NextResponse.json(
        { error: "Description must not exceed 500 characters" },
        { status: 400 },
      );
    }
    if (receiptUrl != null) {
      try {
        const parsed = new URL(receiptUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "receiptUrl must be a valid http or https URL" },
          { status: 400 },
        );
      }
    }
    if (debitAccountId === creditAccountId) {
      return NextResponse.json(
        { error: "Debit and credit accounts must be different" },
        { status: 400 },
      );
    }

    const [debit, credit] = await Promise.all([
      findAccountInBuilding(debitAccountId, buildingId),
      findAccountInBuilding(creditAccountId, buildingId),
    ]);
    if (!debit) {
      return NextResponse.json(
        { error: "Debit account not found" },
        { status: 400 },
      );
    }
    if (!credit) {
      return NextResponse.json(
        { error: "Credit account not found" },
        { status: 400 },
      );
    }

    const entry = await createLedgerEntry({
      date: parsedDate,
      debitAccountId,
      creditAccountId,
      amount,
      description,
      receiptUrl: receiptUrl ?? null,
      createdById: userId,
    });

    await ledgerEntryCreated({
      entryId: entry.id,
      createdByUserId: userId,
      buildingId,
      date,
      debitAccountId,
      creditAccountId,
      amount,
      description,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create ledger entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
