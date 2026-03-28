import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const accountId = searchParams.get("accountId") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    // Scope to entries where at least one account belongs to this building
    const buildingAccountIds = (
      await prisma.account.findMany({
        where: { buildingId },
        select: { id: true },
      })
    ).map((a) => a.id);

    const where: Prisma.LedgerEntryWhereInput = {
      OR: [
        { debitAccountId: { in: buildingAccountIds } },
        { creditAccountId: { in: buildingAccountIds } },
      ],
    };

    // Date filters
    if (fromParam || toParam) {
      const from = fromParam ? new Date(fromParam) : undefined;
      const to = toParam ? new Date(toParam) : undefined;

      if ((fromParam && isNaN(from!.getTime())) || (toParam && isNaN(to!.getTime()))) {
        return NextResponse.json(
          { error: "Invalid date format for 'from' or 'to'" },
          { status: 400 }
        );
      }

      if (from && to && from > to) {
        return NextResponse.json(
          { error: "'from' date must not be after 'to' date" },
          { status: 400 }
        );
      }

      if (from && to) {
        const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
        if (to.getTime() - from.getTime() > fiveYearsMs) {
          return NextResponse.json(
            { error: "Date range must not exceed 5 years" },
            { status: 400 }
          );
        }
      }

      // Normalize 'to' date to end-of-day when it's a date-only string (YYYY-MM-DD)
      if (to && toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
        to.setHours(23, 59, 59, 999);
      }

      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    // Account filter — match entries where either debit or credit uses this account
    if (accountId) {
      // Verify account belongs to this building
      if (!buildingAccountIds.includes(accountId)) {
        return NextResponse.json({ entries: [], total: 0, page, totalPages: 0 });
      }
      where.OR = [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: {
          debitAccount: { select: { name: true } },
          creditAccount: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

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
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { date, debitAccountId, creditAccountId, amount, description, receiptUrl } = body;

    // Validate required fields
    if (!date || !debitAccountId || !creditAccountId || amount == null || !description) {
      return NextResponse.json(
        { error: "Missing required fields: date, debitAccountId, creditAccountId, amount, description" },
        { status: 400 }
      );
    }

    // Validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    if (amount > 10_000_000) {
      return NextResponse.json(
        { error: "Amount must not exceed 10,000,000" },
        { status: 400 }
      );
    }

    // Validate description length
    if (description.length > 500) {
      return NextResponse.json(
        { error: "Description must not exceed 500 characters" },
        { status: 400 }
      );
    }

    // Validate receiptUrl if provided
    if (receiptUrl != null) {
      try {
        const parsed = new URL(receiptUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "receiptUrl must be a valid http or https URL" },
          { status: 400 }
        );
      }
    }

    // Validate accounts are different
    if (debitAccountId === creditAccountId) {
      return NextResponse.json(
        { error: "Debit and credit accounts must be different" },
        { status: 400 }
      );
    }

    // Validate both accounts exist and belong to this building
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: debitAccountId } }),
      prisma.account.findUnique({ where: { id: creditAccountId } }),
    ]);

    if (!debitAccount || debitAccount.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Debit account not found" },
        { status: 400 }
      );
    }

    if (!creditAccount || creditAccount.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Credit account not found" },
        { status: 400 }
      );
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        date: parsedDate,
        debitAccountId,
        creditAccountId,
        amount: new Prisma.Decimal(amount),
        description,
        receiptUrl: receiptUrl ?? null,
        createdById: userId,
      },
      include: {
        debitAccount: { select: { name: true } },
        creditAccount: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    await createAuditLog({
      entityType: "LedgerEntry",
      entityId: entry.id,
      action: "CREATE",
      userId,
      newValue: {
        date,
        debitAccountId,
        creditAccountId,
        amount,
        description,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create ledger entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
