import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { reportsQueue } from "@/lib/queue";
import {
  computeVoteResultHash,
  computeMeetingSummaryHash,
  computeFinanceSummaryHash,
  computeYearEndAccountHash,
  computeUtilityStatementHash,
  computeMinutesHash,
  computeAuditSliceHash,
} from "@/lib/reports/version-hash";
import { requireRole } from "@/lib/rbac";
import {
  findVoteBuildingScope,
  findMeetingBuildingScope,
} from "@/lib/voting-dal";
import {
  findReportByVersion,
  resetStaleGeneratedReport,
  createGeneratedReport,
} from "@/lib/reports-dal";

export const runtime = "nodejs";

type ReportKind =
  | "vote-result"
  | "meeting-summary"
  | "finance-summary"
  | "year-end-account"
  | "utility-statement"
  | "minutes"
  | "audit-slice";
const KINDS: ReadonlyArray<ReportKind> = [
  "vote-result",
  "meeting-summary",
  "finance-summary",
  "year-end-account",
  "utility-statement",
  "minutes",
  "audit-slice",
];

interface GenerateBody {
  kind: ReportKind;
  refId: string;
}

function parseBody(raw: unknown): GenerateBody | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.kind !== "string" || !KINDS.includes(o.kind as ReportKind))
    return null;
  if (typeof o.refId !== "string" || o.refId.length === 0) return null;
  return { kind: o.kind as ReportKind, refId: o.refId };
}

/** Treat in-flight rows older than this as stale — re-enqueue. */
const STALE_PENDING_MS = 60_000;

interface ResolvedTarget {
  ok: true;
  period: string;
  contentHash: string;
}
type Resolution = ResolvedTarget | { ok: false; status: number; error: string };

async function resolveTarget(opts: {
  kind: ReportKind;
  refId: string;
  buildingId: string;
}): Promise<Resolution> {
  const { kind, refId, buildingId } = opts;
  switch (kind) {
    case "vote-result": {
      if (!(await findVoteBuildingScope(refId, buildingId))) {
        return { ok: false, status: 404, error: "Not found" };
      }
      return {
        ok: true,
        period: `vote-${refId}`,
        contentHash: await computeVoteResultHash(refId),
      };
    }
    case "meeting-summary":
    case "minutes": {
      if (!(await findMeetingBuildingScope(refId, buildingId))) {
        return { ok: false, status: 404, error: "Not found" };
      }
      const period =
        kind === "meeting-summary" ? `meeting-${refId}` : `minutes-${refId}`;
      const contentHash =
        kind === "meeting-summary"
          ? await computeMeetingSummaryHash(refId)
          : await computeMinutesHash(refId);
      return { ok: true, period, contentHash };
    }
    case "finance-summary":
    case "utility-statement": {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(refId)) {
        return {
          ok: false,
          status: 400,
          error: "Invalid period — expected YYYY-MM",
        };
      }
      const period =
        kind === "finance-summary" ? `month-${refId}` : `rezsi-${refId}`;
      const contentHash =
        kind === "finance-summary"
          ? await computeFinanceSummaryHash(buildingId, refId)
          : await computeUtilityStatementHash(buildingId, refId);
      return { ok: true, period, contentHash };
    }
    case "year-end-account": {
      if (!/^\d{4}$/.test(refId)) {
        return {
          ok: false,
          status: 400,
          error: "Invalid period — expected YYYY",
        };
      }
      return {
        ok: true,
        period: `year-${refId}`,
        contentHash: await computeYearEndAccountHash(buildingId, refId),
      };
    }
    case "audit-slice": {
      if (!/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(refId)) {
        return {
          ok: false,
          status: 400,
          error: "Invalid range — expected YYYY-MM-DD_YYYY-MM-DD",
        };
      }
      return {
        ok: true,
        period: `audit-${refId}`,
        contentHash: await computeAuditSliceHash(buildingId, refId),
      };
    }
  }
}

async function applyKindGating(
  kind: ReportKind,
  buildingId: string,
  role: string,
): Promise<NextResponse | null> {
  try {
    if (
      kind === "vote-result" ||
      kind === "meeting-summary" ||
      kind === "minutes"
    ) {
      await requireFeature(buildingId, "voting");
    } else if (
      kind === "finance-summary" ||
      kind === "year-end-account" ||
      kind === "utility-statement"
    ) {
      await requireFeature(buildingId, "finance");
      await requireRole(role, "BOARD_MEMBER");
    } else if (kind === "audit-slice") {
      await requireRole(role, "ADMIN");
    }
    return null;
  } catch (err) {
    if (err instanceof FeatureGateError) {
      return NextResponse.json(
        { error: err.message, upgrade: true },
        { status: 403 },
      );
    }
    throw err;
  }
}

/**
 * POST /api/reports/generate
 * Body: { kind, refId }
 *
 * Returns `{ reportId, status }`. The caller should poll
 * `/api/reports/{reportId}/status` and, on `READY`, redirect to
 * `/api/reports/{reportId}/download`.
 *
 * Dedupe contract: same kind + refId + version-hash → same `reportId`,
 * regardless of which user requests it. PDF is rendered once, served
 * many times.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const body = parseBody(await request.json().catch(() => null));
    if (!body) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { kind, refId } = body;

    const gate = await applyKindGating(kind, buildingId, role);
    if (gate) return gate;

    const resolved = await resolveTarget({ kind, refId, buildingId });
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }
    const { period, contentHash } = resolved;

    const existing = await findReportByVersion({
      buildingId,
      kind,
      period,
      contentHash,
    });

    if (existing) {
      const ageMs = Date.now() - existing.generatedAt.getTime();
      const isStalePending =
        (existing.status === "PENDING" || existing.status === "RUNNING") &&
        ageMs > STALE_PENDING_MS;
      const isFailed = existing.status === "FAILED";

      if (!isStalePending && !isFailed) {
        return NextResponse.json({
          reportId: existing.id,
          status: existing.status,
        });
      }
      await resetStaleGeneratedReport({ id: existing.id, userId });
      await reportsQueue.add(kind, { reportId: existing.id });
      return NextResponse.json({ reportId: existing.id, status: "PENDING" });
    }

    try {
      const report = await createGeneratedReport({
        buildingId,
        kind,
        period,
        contentHash,
        generatedById: userId,
      });
      await reportsQueue.add(kind, { reportId: report.id });
      return NextResponse.json({ reportId: report.id, status: "PENDING" });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002") throw err;
      const racedRow = await findReportByVersion({
        buildingId,
        kind,
        period,
        contentHash,
      });
      if (!racedRow) throw err;
      return NextResponse.json({
        reportId: racedRow.id,
        status: racedRow.status,
      });
    }
  } catch (error) {
    console.error("Failed to enqueue report:", error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json(
      {
        error: "Internal server error",
        debug: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
