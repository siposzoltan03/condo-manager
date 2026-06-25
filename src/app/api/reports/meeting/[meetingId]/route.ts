import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import {
  findMeetingForReport,
  findVoteSummaryForReport,
  listBuildingUnitShares,
} from "@/lib/voting-dal";
import { calculateVoteResult } from "@/lib/voting/quorum";
import { renderToBuffer } from "@/reports/lib/generate";
import { computeReportHash } from "@/reports/lib/footer";
import { registerReportFonts } from "@/reports/lib/fonts";
import { MeetingSummaryPdf } from "@/reports/templates/meeting-summary";

export const runtime = "nodejs";
// Multi-vote bundles can be larger than a single result page.
export const maxDuration = 45;

type RouteContext = { params: Promise<{ meetingId: string }> };

/**
 * Phase-1 inline render of a meeting-summary PDF (jegyzőkönyv-lite).
 * Bundles all votes attached to the meeting, the free-form agenda, and
 * any escalated complaints / board resignations on the queue. Rendered
 * inline — Phase 2 will add R2 caching + worker offload.
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

    const { meetingId } = await context.params;

    const meeting = await findMeetingForReport(meetingId, buildingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const allUnits = await listBuildingUnitShares(buildingId);
    const totalEligibleWeight = allUnits.reduce(
      (sum, u) => sum + Number(u.ownershipShare),
      0,
    );

    // Resolve each vote in parallel (Phase 2 will batch into a single query).
    const voteSummaries = await Promise.all(
      meeting.votes.map(async ({ id }) => {
        const v = await findVoteSummaryForReport(id);
        if (!v) return null;
        const result = await calculateVoteResult(id);
        const totalCastWeight = result.options.reduce(
          (s, o) => s + o.weight,
          0,
        );
        const ballotCount = result.options.reduce((s, o) => s + o.votes, 0);
        return {
          id: v.id,
          title: v.title,
          status: v.status,
          majorityType: v.majorityType,
          isSecret: v.isSecret,
          deadline: v.deadline.toISOString(),
          passed: v.status === "CLOSED" ? result.passed : null,
          options: result.options.map((o) => ({
            id: o.id,
            label: o.label,
            ballotCount: o.votes,
            weight: o.weight,
          })),
          totalEligibleWeight,
          totalCastWeight,
          ballotCount,
        };
      }),
    );
    const votes = voteSummaries.filter(
      (v): v is NonNullable<typeof v> => v !== null,
    );

    const agendaRaw = Array.isArray(meeting.agenda) ? meeting.agenda : [];
    // Strip leading "1.", "2.) ", etc. — some seed data and legacy entries
    // include their own numbering, which collides with the rendered index.
    const stripLeadingNumber = (s: string) =>
      s.replace(/^\s*\d+[.)]\s*/, "").trim();
    const agenda = agendaRaw.map((item) => {
      if (typeof item === "string") return { title: stripLeadingNumber(item) };
      const obj = (item ?? {}) as Record<string, unknown>;
      return {
        title:
          typeof obj.title === "string" ? stripLeadingNumber(obj.title) : "",
        description:
          typeof obj.description === "string" ? obj.description : null,
      };
    });

    const pendingItems = meeting.pendingAgenda.map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      description: p.description,
      resolved: p.resolvedAt !== null,
      resolutionNote: p.resolutionNote,
    }));

    const generatedAt = new Date();
    const dataPayload = {
      meetingId: meeting.id,
      voteIds: votes.map((v) => v.id),
      voteResults: votes.map((v) => ({
        id: v.id,
        passed: v.passed,
        options: v.options,
      })),
      pendingIds: pendingItems.map((p) => p.id),
      agendaCount: agenda.length,
    };
    const contentHash = computeReportHash(dataPayload);

    const buffer = await renderToBuffer(
      MeetingSummaryPdf({
        buildingName: meeting.building.name,
        meeting: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          date: meeting.date.toISOString(),
          time: meeting.time,
          location: meeting.location,
          minutes: meeting.minutes,
        },
        agenda,
        votes,
        pendingItems,
        generatedAt,
        contentHash,
      }),
    );

    const safeTitle = meeting.title
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "_")
      .slice(0, 60);
    const fileName = `kozgyules-${safeTitle}-${contentHash.slice(0, 8)}.pdf`;

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
    console.error("Failed to render meeting-summary PDF:", error);
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
