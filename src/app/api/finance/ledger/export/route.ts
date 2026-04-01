import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requireFeature(buildingId, "finance");

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {
      OR: [
        { debitAccount: { buildingId } },
        { creditAccount: { buildingId } },
      ],
    };

    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
      };
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        debitAccount: { select: { name: true } },
        creditAccount: { select: { name: true } },
      },
      orderBy: { date: "asc" },
      take: 10000,
    });

    // Build CSV
    const header = "Date,Description,Debit Account,Credit Account,Amount";
    const rows = entries.map((e) => {
      const date = e.date.toISOString().split("T")[0];
      const desc = `"${e.description.replace(/"/g, '""')}"`;
      const debit = e.debitAccount.name;
      const credit = e.creditAccount.name;
      const amount = Number(e.amount).toFixed(2);
      return `${date},${desc},${debit},${credit},${amount}`;
    });

    const csv = [header, ...rows].join("\n");
    const fromLabel = from ?? "all";
    const toLabel = to ?? "now";

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger-${fromLabel}-${toLabel}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export ledger:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
