import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const year = searchParams.get("year") ?? undefined;
    const unitIdParam = searchParams.get("unitId") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 1 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const isBoardPlus = hasMinimumRole(user.role, "BOARD_MEMBER");

    // Determine which unit to query
    let targetUnitId: string;
    if (isBoardPlus && unitIdParam) {
      targetUnitId = unitIdParam;
    } else {
      targetUnitId = user.unitId;
    }

    const where: Prisma.MonthlyChargeWhereInput = {
      unitId: targetUnitId,
    };

    // Filter by year (month field is "YYYY-MM")
    if (year && /^\d{4}$/.test(year)) {
      where.month = { startsWith: year };
    }

    const [charges, total] = await Promise.all([
      prisma.monthlyCharge.findMany({
        where,
        include: {
          unit: {
            select: { number: true },
          },
        },
        orderBy: { month: "desc" },
        skip,
        take: limit,
      }),
      prisma.monthlyCharge.count({ where }),
    ]);

    return NextResponse.json({
      charges,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch charges:", error);
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

    try {
      await requireRole(user.role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { charges } = body;

    if (!Array.isArray(charges) || charges.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: charges (non-empty array)" },
        { status: 400 }
      );
    }

    // Validate each charge entry
    for (const charge of charges) {
      if (!charge.unitId || !charge.month || charge.amount == null) {
        return NextResponse.json(
          { error: "Each charge must have unitId, month, and amount" },
          { status: 400 }
        );
      }
      if (!/^\d{4}-\d{2}$/.test(charge.month)) {
        return NextResponse.json(
          { error: `Invalid month format: ${charge.month}. Expected YYYY-MM` },
          { status: 400 }
        );
      }
      if (typeof charge.amount !== "number" || charge.amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be a positive number" },
          { status: 400 }
        );
      }
      if (charge.amount > 10_000_000) {
        return NextResponse.json(
          { error: "Amount must not exceed 10,000,000" },
          { status: 400 }
        );
      }
    }

    const result = await prisma.monthlyCharge.createMany({
      data: charges.map((c: { unitId: string; month: string; amount: number }) => ({
        unitId: c.unitId,
        month: c.month,
        amount: new Prisma.Decimal(c.amount),
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      entityType: "MonthlyCharge",
      entityId: "bulk",
      action: "CREATE",
      userId: user.id,
      newValue: { count: result.count, charges },
    });

    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch (error) {
    console.error("Failed to create charges:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
