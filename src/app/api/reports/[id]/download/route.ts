import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { findReportForDownload } from "@/lib/reports-dal";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/reports/{id}/download
 * Streams the rendered PDF bytes. RBAC is by-kind: today every member of
 * the building can fetch any READY report — Phase 3 will narrow this
 * for finance + audit-slice kinds.
 *
 * Today the local-FS storage driver returns a stream. When we cut over
 * to R2, this handler will instead 302 to a signed-GET URL.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { buildingId } = await requireBuildingContext();
    const { id } = await context.params;

    const report = await findReportForDownload(id, buildingId);
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (report.status !== "READY" || !report.storageKey) {
      return NextResponse.json(
        { error: "Report not ready", status: report.status },
        { status: 409 },
      );
    }

    const { body, contentType, contentLength } = await getStorage().read(
      report.storageKey,
    );
    if (!Buffer.isBuffer(body)) {
      // Future R2 driver may return a stream — handle on cutover.
      throw new Error("Streamed read not yet supported by download route");
    }

    const fileName = `${report.kind}-${report.id.slice(0, 8)}.pdf`;
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/pdf",
        "Content-Length": String(contentLength),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=600",
        "X-Report-Hash": report.contentHash,
      },
    });
  } catch (error) {
    console.error("Failed to download report:", error);
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
        : String(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        debug: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
