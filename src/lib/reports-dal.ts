import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Reports Data Access Layer (flat file — will fold into
 * `lib/reports/dal.ts` later; see plan §4 #3).
 *
 * All reads are cross-tenant safe: each function takes `buildingId`
 * alongside the report id and uses `findFirst({ where: { id,
 * buildingId } })`, so a leaked report id can't cross tenants.
 */

export async function findReportStatus(reportId: string, buildingId: string) {
  return prisma.generatedReport.findFirst({
    where: { id: reportId, buildingId },
    select: {
      id: true,
      status: true,
      errorMessage: true,
      fileSize: true,
    },
  });
}

export async function findReportForDownload(
  reportId: string,
  buildingId: string,
) {
  return prisma.generatedReport.findFirst({
    where: { id: reportId, buildingId },
  });
}

// ────────────────────────────────────────────────────────────────────────
// /api/reports/generate — dedupe row operations
// ────────────────────────────────────────────────────────────────────────

export async function findReportByVersion(opts: {
  buildingId: string;
  kind: string;
  period: string;
  contentHash: string;
}) {
  return prisma.generatedReport.findUnique({
    where: {
      buildingId_kind_period_contentHash: {
        buildingId: opts.buildingId,
        kind: opts.kind,
        period: opts.period,
        contentHash: opts.contentHash,
      },
    },
  });
}

export async function resetStaleGeneratedReport(opts: {
  id: string;
  userId: string;
}) {
  return prisma.generatedReport.update({
    where: { id: opts.id },
    data: {
      status: "PENDING",
      errorMessage: null,
      finishedAt: null,
      generatedAt: new Date(),
      generatedById: opts.userId,
    },
  });
}

export async function createGeneratedReport(opts: {
  buildingId: string;
  kind: string;
  period: string;
  contentHash: string;
  generatedById: string;
}) {
  return prisma.generatedReport.create({
    data: {
      buildingId: opts.buildingId,
      kind: opts.kind,
      period: opts.period,
      contentHash: opts.contentHash,
      status: "PENDING",
      generatedById: opts.generatedById,
    },
  });
}
