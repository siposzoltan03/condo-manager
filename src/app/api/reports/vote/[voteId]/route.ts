import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import {
  findVoteForReport,
  listBuildingUnitShares,
} from "@/lib/voting-dal";
import { calculateVoteResult } from "@/lib/voting/quorum";
import { renderToBuffer } from "@/reports/lib/generate";
import { computeReportHash } from "@/reports/lib/footer";
import { registerReportFonts } from "@/reports/lib/fonts";
import { VoteResultPdf } from "@/reports/templates/vote-result";

export const runtime = "nodejs";
// PDF generation is CPU-bound; allow more than the default 10 s.
export const maxDuration = 30;

type RouteContext = { params: Promise<{ voteId: string }> };

/**
 * Phase-1 inline render of a vote-result PDF. Streams the bytes back to
 * the client. Phase 2 will add R2 caching + worker offload — but a
 * single vote with ≤ 200 ballots is well under a second to render and
 * fits comfortably in this code path.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    registerReportFonts();
    const { buildingId } = await requireBuildingContext();
    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        );
      }
      throw err;
    }

    const { voteId } = await context.params;

    const vote = await findVoteForReport(voteId, buildingId);
    if (!vote) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    const result = await calculateVoteResult(voteId);

    // Total eligible weight = sum of all unit shares in the building.
    const allUnits = await listBuildingUnitShares(buildingId);
    const totalEligibleWeight = allUnits.reduce(
      (sum, u) => sum + Number(u.ownershipShare),
      0,
    );

    // Cast-weight is the sum across all options' weights.
    const totalCastWeight = result.options.reduce(
      (sum, o) => sum + o.weight,
      0,
    );
    const ballotCount = result.options.reduce(
      (sum, o) => sum + o.votes,
      0,
    );

    const generatedAt = new Date();
    const dataPayload = {
      voteId: vote.id,
      status: vote.status,
      ballotCount,
      options: result.options,
      totalCastWeight,
      totalEligibleWeight,
      passed: vote.status === "CLOSED" ? result.passed : null,
    };
    const contentHash = computeReportHash(dataPayload);

    const buffer = await renderToBuffer(
      VoteResultPdf({
        buildingName: vote.building.name,
        vote: {
          id: vote.id,
          title: vote.title,
          description: vote.description,
          voteType: vote.voteType,
          majorityType: vote.majorityType,
          isSecret: vote.isSecret,
          deadline: vote.deadline.toISOString(),
          status: vote.status,
          passed: vote.status === "CLOSED" ? result.passed : null,
        },
        options: result.options.map((o) => ({
          id: o.id,
          label: o.label,
          ballotCount: o.votes,
          weight: o.weight,
        })),
        totalEligibleWeight,
        totalCastWeight,
        ballotCount,
        generatedAt,
        contentHash,
      }),
    );

    const safeTitle = vote.title
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "_")
      .slice(0, 60);
    const fileName = `szavazas-${safeTitle}-${contentHash.slice(0, 8)}.pdf`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=600",
        "X-Report-Hash": contentHash,
      },
    });
  } catch (error) {
    console.error("Failed to render vote-result PDF:", error);
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
        : String(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        // Surface the underlying error in dev so the browser shows it. Strip
        // before going to prod — Phase 2 will route this through a logger.
        debug: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
