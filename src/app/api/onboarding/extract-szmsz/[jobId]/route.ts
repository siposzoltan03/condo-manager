import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/onboarding/extract-szmsz/[jobId] — poll an extraction job.
 * Returns { status, result?, error? }. status ∈ PENDING|RUNNING|READY|FAILED.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "board.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { jobId } = await params;

    const job = await prisma.szmszExtractionJob.findUnique({
      where: { id: jobId },
      select: { buildingId: true, status: true, result: true, errorMessage: true },
    });
    if (!job || job.buildingId !== ctx.buildingId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: job.status,
      result: job.status === "READY" ? job.result : null,
      error: job.status === "FAILED" ? (job.errorMessage ?? "Extraction failed") : null,
    });
  } catch (error) {
    console.error("SZMSZ job status failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
