import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-gate";
import { listLedgerEntriesForExport } from "@/lib/finance-dal";

export async function GET(request: NextRequest) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requireFeature(buildingId, "finance");

    const { searchParams } = request.nextUrl;
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw + "T23:59:59") : null;

    const entries = await listLedgerEntriesForExport({ buildingId, from, to });

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
    const fromLabel = fromRaw ?? "all";
    const toLabel = toRaw ?? "now";

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ledger-${fromLabel}-${toLabel}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export ledger:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
