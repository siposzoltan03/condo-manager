import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
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

    const where: Prisma.LedgerEntryWhereInput = {};

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
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

    // Validate accounts are different
    if (debitAccountId === creditAccountId) {
      return NextResponse.json(
        { error: "Debit and credit accounts must be different" },
        { status: 400 }
      );
    }

    // Validate both accounts exist
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findUnique({ where: { id: debitAccountId } }),
      prisma.account.findUnique({ where: { id: creditAccountId } }),
    ]);

    if (!debitAccount) {
      return NextResponse.json(
        { error: "Debit account not found" },
        { status: 400 }
      );
    }

    if (!creditAccount) {
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
        createdById: user.id,
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
      userId: user.id,
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
