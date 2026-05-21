import type { Job } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import { getStorage } from "../../src/lib/storage";
import { notify, NotificationType } from "../../src/lib/notifications";
import { workerT } from "../i18n";
import { renderToBuffer } from "../../src/reports/lib/generate";
import { registerReportFonts } from "../../src/reports/lib/fonts";
import { computeReportHash } from "../../src/reports/lib/footer";
import { calculateVoteResult } from "../../src/lib/voting/quorum";
import { VoteResultPdf } from "../../src/reports/templates/vote-result";
import { MeetingSummaryPdf } from "../../src/reports/templates/meeting-summary";
import { FinanceSummaryPdf } from "../../src/reports/templates/finance-summary";
import { computeFinanceSummaryData } from "../../src/lib/reports/finance-summary-data";
import { YearEndAccountPdf } from "../../src/reports/templates/year-end-account";
import { computeYearEndAccountData } from "../../src/lib/reports/year-end-account-data";
import { UtilityStatementPdf } from "../../src/reports/templates/utility-statement";
import { computeUtilityStatementData } from "../../src/lib/reports/utility-statement-data";
import { MinutesPdf } from "../../src/reports/templates/minutes";
import { computeMinutesData } from "../../src/lib/reports/minutes-data";
import { AuditSlicePdf } from "../../src/reports/templates/audit-slice";
import { computeAuditSliceData } from "../../src/lib/reports/audit-slice-data";

/**
 * Job payload — the worker receives the GeneratedReport row id and the
 * canonical inputs needed to render. The row already exists in the DB
 * (status=PENDING) so concurrent generate-requests share a single job.
 */
export interface ReportJobData {
  reportId: string;
}

export async function processReportJob(job: Job<ReportJobData>): Promise<void> {
  const { reportId } = job.data;
  const report = await prisma.generatedReport.findUnique({
    where: { id: reportId },
  });
  if (!report) {
    // Row was deleted between enqueue and pickup — drop the job silently.
    return;
  }
  if (report.status === "READY") {
    // Already done by another worker / a duplicate enqueue. Idempotent.
    return;
  }

  await prisma.generatedReport.update({
    where: { id: report.id },
    data: { status: "RUNNING" },
  });

  try {
    registerReportFonts();

    let buffer: Buffer;
    let fileName: string;

    switch (report.kind) {
      case "vote-result": {
        const voteId = parsePeriod(report.period, "vote-");
        buffer = await renderVoteResult(voteId);
        fileName = `szavazas-${voteId}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      case "meeting-summary": {
        const meetingId = parsePeriod(report.period, "meeting-");
        buffer = await renderMeetingSummary(meetingId);
        fileName = `kozgyules-${meetingId}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      case "finance-summary": {
        const ym = parsePeriod(report.period, "month-");
        buffer = await renderFinanceSummary(report.buildingId, ym);
        fileName = `penzugy-${ym}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      case "year-end-account": {
        const yyyy = parsePeriod(report.period, "year-");
        buffer = await renderYearEndAccount(report.buildingId, yyyy);
        fileName = `eves-elszamolas-${yyyy}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      case "utility-statement": {
        const ym = parsePeriod(report.period, "rezsi-");
        buffer = await renderUtilityStatement(report.buildingId, ym);
        fileName = `rezsi-${ym}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      case "minutes": {
        const meetingId = parsePeriod(report.period, "minutes-");
        buffer = await renderMinutes(meetingId);
        fileName = `jegyzokonyv-${meetingId}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      case "audit-slice": {
        const range = parsePeriod(report.period, "audit-");
        buffer = await renderAuditSlice(
          report.buildingId,
          range,
          report.generatedById,
        );
        fileName = `audit-${range}-${report.contentHash.slice(0, 8)}.pdf`;
        break;
      }
      default:
        throw new Error(`Unknown report kind: ${report.kind}`);
    }

    // Persist via the storage abstraction. Today this is the local FS
    // driver; swap for R2 by changing getStorage()'s implementation.
    const stored = await getStorage().put({
      scope: "report",
      fileName,
      mimeType: "application/pdf",
      body: buffer,
    });

    await prisma.generatedReport.update({
      where: { id: report.id },
      data: {
        status: "READY",
        storageKey: stored.key,
        fileSize: buffer.length,
        finishedAt: new Date(),
      },
    });

    // Ping the requester. The polling UI already opens the file in the
    // happy path, but the notification covers the case where the user
    // navigated away or the polling timed out (30s ceiling). The user can
    // mute via the announcements row of the matrix prefs.
    const requester = await prisma.user.findUnique({
      where: { id: report.generatedById },
      select: { language: true },
    });
    const locale = requester?.language ?? "hu";
    const kindLabel = workerT(locale, `reports.kindLabel.${report.kind}`);
    await notify({
      userIds: [report.generatedById],
      type: NotificationType.REPORT_READY,
      title: workerT(locale, "reports.notification.readyTitle", {
        kind: kindLabel,
      }),
      body: workerT(locale, "reports.notification.readyBody", {
        fileName,
      }),
      entityType: "GeneratedReport",
      entityId: report.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.generatedReport.update({
      where: { id: report.id },
      data: {
        status: "FAILED",
        errorMessage: message.slice(0, 1000),
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

function parsePeriod(period: string, prefix: string): string {
  if (!period.startsWith(prefix)) {
    throw new Error(`Period "${period}" does not start with "${prefix}"`);
  }
  return period.slice(prefix.length);
}


async function renderVoteResult(voteId: string): Promise<Buffer> {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    include: { building: { select: { name: true } } },
  });
  if (!vote) throw new Error(`Vote ${voteId} not found`);

  const result = await calculateVoteResult(voteId);
  const allUnits = await prisma.unit.findMany({
    where: { buildingId: vote.buildingId },
    select: { ownershipShare: true },
  });
  const totalEligibleWeight = allUnits.reduce(
    (sum, u) => sum + Number(u.ownershipShare),
    0,
  );
  const totalCastWeight = result.options.reduce((s, o) => s + o.weight, 0);
  const ballotCount = result.options.reduce((s, o) => s + o.votes, 0);

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

  return renderToBuffer(
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
}

async function renderFinanceSummary(
  buildingId: string,
  ym: string,
): Promise<Buffer> {
  const data = await computeFinanceSummaryData(buildingId, ym);
  const generatedAt = new Date();
  const dataPayload = {
    buildingId,
    period: data.period,
    openingBalance: data.openingBalance,
    closingBalance: data.closingBalance,
    totalIncome: data.totalIncome,
    totalExpenses: data.totalExpenses,
    incomeByCategory: data.incomeByCategory,
    expenseByCategory: data.expenseByCategory,
    topEntryIds: data.topEntries.map((e) => e.id),
  };
  const contentHash = computeReportHash(dataPayload);
  return renderToBuffer(
    FinanceSummaryPdf({ ...data, generatedAt, contentHash }),
  );
}

async function renderYearEndAccount(
  buildingId: string,
  yearStr: string,
): Promise<Buffer> {
  const data = await computeYearEndAccountData(buildingId, yearStr);
  // Approval tracking is a follow-up — every year-end PDF is currently
  // a tervezet (draft) until the közgyűlés ratification flow lands.
  const isDraft = true;
  const generatedAt = new Date();
  const dataPayload = {
    buildingId,
    year: data.year,
    isDraft,
    openingBalance: data.openingBalance,
    closingBalance: data.closingBalance,
    totalIncome: data.totalIncome,
    totalExpenses: data.totalExpenses,
    assetIds: data.assets.map((a) => a.name),
    budgetIds: data.budget.map((b) => b.accountName),
    perOwnerIds: data.perOwner.map((p) => p.unitNumber),
  };
  const contentHash = computeReportHash(dataPayload);
  return renderToBuffer(
    YearEndAccountPdf({ ...data, generatedAt, contentHash, isDraft }),
  );
}

async function renderUtilityStatement(
  buildingId: string,
  ym: string,
): Promise<Buffer> {
  const data = await computeUtilityStatementData(buildingId, ym);
  const generatedAt = new Date();
  const dataPayload = {
    buildingId,
    period: data.period,
    utilities: data.utilities.map((u) => ({
      name: u.name,
      amount: u.amount,
      prevAmount: u.prevAmount,
    })),
    totalAmount: data.totalAmount,
    perUnit: data.perUnit.map((p) => ({
      unit: p.unitNumber,
      alloc: p.allocation,
    })),
  };
  const contentHash = computeReportHash(dataPayload);
  return renderToBuffer(
    UtilityStatementPdf({ ...data, generatedAt, contentHash }),
  );
}

async function renderMinutes(meetingId: string): Promise<Buffer> {
  const data = await computeMinutesData(meetingId);
  const generatedAt = new Date();
  const dataPayload = {
    meetingId,
    isExecuted: data.isExecuted,
    attendanceCount: data.attendance.length,
    totalAttendingShare: data.totalAttendingShare,
    isQuorate: data.isQuorate,
    resolutions: data.resolutions.map((r) => ({
      id: r.id,
      passed: r.passed,
      ballotCount: r.ballotCount,
    })),
    signatures: data.signatures.map((s) => ({
      role: s.role,
      signerName: s.signerName,
      signedAt: s.signedAt,
    })),
  };
  const contentHash = computeReportHash(dataPayload);
  return renderToBuffer(
    MinutesPdf({ ...data, generatedAt, contentHash }),
  );
}

async function renderAuditSlice(
  buildingId: string,
  range: string,
  generatedById: string,
): Promise<Buffer> {
  const m = range.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!m) throw new Error(`Invalid audit-slice range "${range}"`);
  const from = new Date(`${m[1]}T00:00:00.000Z`);
  const to = new Date(`${m[2]}T23:59:59.999Z`);
  const data = await computeAuditSliceData(
    buildingId,
    { from, to },
    generatedById,
  );
  const generatedAt = new Date();
  const dataPayload = {
    buildingId,
    range,
    generatedById,
    rowIds: data.rows.map((r) => r.id),
    totalCount: data.totalCount,
    manifestHash: data.manifestHash,
  };
  const contentHash = computeReportHash(dataPayload);
  return renderToBuffer(
    AuditSlicePdf({ ...data, generatedAt, contentHash }),
  );
}

async function renderMeetingSummary(meetingId: string): Promise<Buffer> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      building: { select: { name: true } },
      votes: { orderBy: { createdAt: "asc" }, select: { id: true } },
      pendingAgenda: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          resolutionNote: true,
          resolvedAt: true,
        },
      },
    },
  });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const allUnits = await prisma.unit.findMany({
    where: { buildingId: meeting.buildingId },
    select: { ownershipShare: true },
  });
  const totalEligibleWeight = allUnits.reduce(
    (sum, u) => sum + Number(u.ownershipShare),
    0,
  );

  const voteSummaries = await Promise.all(
    meeting.votes.map(async ({ id }) => {
      const v = await prisma.vote.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          majorityType: true,
          isSecret: true,
          deadline: true,
        },
      });
      if (!v) return null;
      const result = await calculateVoteResult(id);
      const totalCastWeight = result.options.reduce((s, o) => s + o.weight, 0);
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

  const stripLeadingNumber = (s: string) =>
    s.replace(/^\s*\d+[.)]\s*/, "").trim();
  const agendaRaw = Array.isArray(meeting.agenda) ? meeting.agenda : [];
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

  return renderToBuffer(
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
}
