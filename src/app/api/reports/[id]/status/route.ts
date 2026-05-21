import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { findReportStatus } from "@/lib/reports-dal";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/reports/{id}/status
 * Polled by the client while a report is being rendered. Returns
 * `{ status, downloadUrl?, errorMessage? }`. The download URL is
 * provided once the row reaches `READY`.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { buildingId } = await requireBuildingContext();
    const { id } = await context.params;

    const report = await findReportStatus(id, buildingId);
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: report.status,
      downloadUrl:
        report.status === "READY" ? `/api/reports/${report.id}/download` : null,
      errorMessage: report.errorMessage,
      fileSize: report.fileSize,
    });
  } catch (error) {
    console.error("Failed to fetch report status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
