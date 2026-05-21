import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Cheap version digests used for report-cache dedupe.
 *
 * Goal: a SHA-256 over a small set of fields that change whenever the
 * rendered output would change, computed by the route handler in
 * milliseconds. Any time the digest matches a prior `GeneratedReport`
 * row, we serve the cached PDF instead of re-rendering.
 *
 * Trade-off: this is a *version* hash, not a *content* hash. We can't
 * compare against the actual rendered bytes here (rendering is what we
 * want to skip). If a template change happens, the hash won't shift —
 * bumping the per-template constants below is the escape hatch.
 */

const VOTE_TEMPLATE_VERSION = 1;
const MEETING_TEMPLATE_VERSION = 1;
const FINANCE_SUMMARY_TEMPLATE_VERSION = 1;
const YEAR_END_TEMPLATE_VERSION = 2;
const UTILITY_STATEMENT_TEMPLATE_VERSION = 1;
const MINUTES_TEMPLATE_VERSION = 1;
const AUDIT_SLICE_TEMPLATE_VERSION = 2;

export async function computeVoteResultHash(voteId: string): Promise<string> {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!vote) throw new Error("Vote not found");

  const ballotAgg = await prisma.ballot.aggregate({
    where: { voteId },
    _count: true,
    _max: { createdAt: true },
  });

  const parts = [
    `tpl:${VOTE_TEMPLATE_VERSION}`,
    `vote:${vote.id}`,
    `status:${vote.status}`,
    `updatedAt:${vote.updatedAt.toISOString()}`,
    `ballots:${ballotAgg._count}`,
    `lastBallot:${ballotAgg._max.createdAt?.toISOString() ?? "none"}`,
  ];
  return sha256(parts.join("|"));
}

export async function computeMeetingSummaryHash(
  meetingId: string,
): Promise<string> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, updatedAt: true },
  });
  if (!meeting) throw new Error("Meeting not found");

  const [votes, pending, ballotMaxes] = await Promise.all([
    prisma.vote.findMany({
      where: { meetingId },
      select: { id: true, status: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.pendingAgendaItem.findMany({
      where: { attachedMeetingId: meetingId },
      select: { id: true, updatedAt: true, resolvedAt: true },
      orderBy: { id: "asc" },
    }),
    prisma.ballot.groupBy({
      by: ["voteId"],
      where: { vote: { meetingId } },
      _count: true,
      _max: { createdAt: true },
    }),
  ]);

  const ballotMap = new Map(
    ballotMaxes.map((b) => [
      b.voteId,
      `${b._count}@${b._max.createdAt?.toISOString() ?? "none"}`,
    ]),
  );

  const parts = [
    `tpl:${MEETING_TEMPLATE_VERSION}`,
    `meeting:${meeting.id}`,
    `updatedAt:${meeting.updatedAt.toISOString()}`,
    `votes:${votes
      .map(
        (v) =>
          `${v.id}/${v.status}/${v.updatedAt.toISOString()}/${ballotMap.get(v.id) ?? "0@none"}`,
      )
      .join(",")}`,
    `pending:${pending
      .map(
        (p) =>
          `${p.id}/${p.updatedAt.toISOString()}/${p.resolvedAt?.toISOString() ?? "open"}`,
      )
      .join(",")}`,
  ];
  return sha256(parts.join("|"));
}

/**
 * Version-hash for the monthly finance-summary PDF. Period is YYYY-MM.
 *
 * The hash flips when:
 *   - a ledger entry dated within the month is added or backdated
 *   - the entry's `createdAt` shifts (covers re-imports)
 *
 * It does NOT cover account renames or budget edits — those are
 * acceptable cache misses for the next regen on demand.
 */
export async function computeFinanceSummaryHash(
  buildingId: string,
  period: string,
): Promise<string> {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Invalid period "${period}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const agg = await prisma.ledgerEntry.aggregate({
    where: {
      date: { gte: periodStart, lt: periodEnd },
      OR: [
        { debitAccount: { buildingId } },
        { creditAccount: { buildingId } },
      ],
    },
    _count: true,
    _max: { createdAt: true },
    _sum: { amount: true },
  });

  const parts = [
    `tpl:${FINANCE_SUMMARY_TEMPLATE_VERSION}`,
    `bld:${buildingId}`,
    `period:${period}`,
    `entries:${agg._count}`,
    `lastCreated:${agg._max.createdAt?.toISOString() ?? "none"}`,
    `sum:${agg._sum.amount?.toString() ?? "0"}`,
  ];
  return sha256(parts.join("|"));
}

/**
 * Version-hash for the year-end-account PDF. Period is YYYY.
 *
 * The hash flips on:
 *   - new ledger entries dated within the year, or backdated to it
 *   - budget rows for the year added/edited
 *   - monthly charges for the year posted/paid (drives per-tulajdonos)
 *
 * Account renames don't shift the hash — that's an intentional
 * simplification; the `YEAR_END_TEMPLATE_VERSION` is the escape hatch.
 */
export async function computeYearEndAccountHash(
  buildingId: string,
  yearStr: string,
): Promise<string> {
  if (!/^\d{4}$/.test(yearStr)) throw new Error(`Invalid year "${yearStr}"`);
  const year = Number(yearStr);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [ledgerAgg, budgetAgg, chargeAgg] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        date: { gte: yearStart, lt: yearEnd },
        OR: [
          { debitAccount: { buildingId } },
          { creditAccount: { buildingId } },
        ],
      },
      _count: true,
      _max: { createdAt: true },
      _sum: { amount: true },
    }),
    prisma.budget.aggregate({
      where: { year, account: { buildingId } },
      _count: true,
      _sum: { plannedAmount: true },
    }),
    prisma.monthlyCharge.aggregate({
      where: {
        unit: { buildingId },
        month: { startsWith: `${year}-` },
      },
      _count: true,
      _max: { paidAt: true },
      _sum: { amount: true },
    }),
  ]);

  const parts = [
    `tpl:${YEAR_END_TEMPLATE_VERSION}`,
    `bld:${buildingId}`,
    `year:${year}`,
    `ledger:${ledgerAgg._count}/${ledgerAgg._max.createdAt?.toISOString() ?? "none"}/${ledgerAgg._sum.amount?.toString() ?? "0"}`,
    `budget:${budgetAgg._count}/${budgetAgg._sum.plannedAmount?.toString() ?? "0"}`,
    `charges:${chargeAgg._count}/${chargeAgg._max.paidAt?.toISOString() ?? "none"}/${chargeAgg._sum.amount?.toString() ?? "0"}`,
  ];
  return sha256(parts.join("|"));
}

/**
 * Version-hash for the utility-statement (rezsi) PDF. Period is YYYY-MM.
 *
 * The hash flips on:
 *   - utility expense entries dated within the month or the prior
 *     reference month (the report shows both)
 *   - unit ownership changes that affect per-unit allocation
 *
 * Account renames don't shift the hash; bump
 * `UTILITY_STATEMENT_TEMPLATE_VERSION` when the layout changes.
 */
export async function computeUtilityStatementHash(
  buildingId: string,
  period: string,
): Promise<string> {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`Invalid period "${period}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const prevStart = new Date(Date.UTC(year, month - 2, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const [ledgerAgg, unitAgg] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        date: { gte: prevStart, lt: periodEnd },
        debitAccount: { buildingId, type: "EXPENSE" },
      },
      _count: true,
      _max: { createdAt: true },
      _sum: { amount: true },
    }),
    prisma.unit.aggregate({
      where: { buildingId },
      _count: true,
      _max: { updatedAt: true },
      _sum: { ownershipShare: true },
    }),
  ]);

  const parts = [
    `tpl:${UTILITY_STATEMENT_TEMPLATE_VERSION}`,
    `bld:${buildingId}`,
    `period:${period}`,
    `ledger:${ledgerAgg._count}/${ledgerAgg._max.createdAt?.toISOString() ?? "none"}/${ledgerAgg._sum.amount?.toString() ?? "0"}`,
    `units:${unitAgg._count}/${unitAgg._max.updatedAt?.toISOString() ?? "none"}/${unitAgg._sum.ownershipShare?.toString() ?? "0"}`,
  ];
  return sha256(parts.join("|"));
}

/**
 * Version-hash for the jegyzőkönyv (minutes) PDF.
 *
 * The hash flips on:
 *   - meeting metadata edits (title/agenda/minutes blob via updatedAt)
 *   - new attendance check-ins
 *   - vote close-out (the resolution outcome changes)
 *   - signature claim (each filled slot changes the rendered "executed" state)
 *
 * When all three signatures are present, the hash will lock to a stable
 * value — that's the legally-binding executed copy.
 */
export async function computeMinutesHash(meetingId: string): Promise<string> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, updatedAt: true, isRepeated: true },
  });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const [attendanceAgg, voteAgg, signatures] = await Promise.all([
    prisma.meetingAttendance.aggregate({
      where: { meetingId, checkedIn: true },
      _count: true,
      _max: { checkedInAt: true },
    }),
    prisma.vote.aggregate({
      where: { meetingId },
      _count: true,
      _max: { updatedAt: true },
    }),
    prisma.meetingMinutesSignature.findMany({
      where: { meetingId },
      orderBy: { role: "asc" },
      select: { role: true, signerId: true, signedAt: true },
    }),
  ]);

  const sigPart = signatures
    .map((s) => `${s.role}:${s.signerId}:${s.signedAt.toISOString()}`)
    .join(",");

  const parts = [
    `tpl:${MINUTES_TEMPLATE_VERSION}`,
    `meeting:${meeting.id}`,
    `meetingUpdated:${meeting.updatedAt.toISOString()}`,
    `repeated:${meeting.isRepeated}`,
    `attendance:${attendanceAgg._count}/${attendanceAgg._max.checkedInAt?.toISOString() ?? "none"}`,
    `votes:${voteAgg._count}/${voteAgg._max.updatedAt?.toISOString() ?? "none"}`,
    `sigs:${sigPart}`,
  ];
  return sha256(parts.join("|"));
}

/**
 * Version-hash for the audit-slice PDF. `range` is `YYYY-MM-DD_YYYY-MM-DD`.
 *
 * The hash flips when the underlying audit-log set changes (count + max
 * createdAt). It does NOT factor in who's generating — the same range
 * yields the same canonical row set, so the cache is shareable across
 * admins.
 */
export async function computeAuditSliceHash(
  buildingId: string,
  range: string,
): Promise<string> {
  const m = range.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (!m) throw new Error(`Invalid audit range "${range}"`);
  const from = new Date(`${m[1]}T00:00:00.000Z`);
  const to = new Date(`${m[2]}T23:59:59.999Z`);

  const agg = await prisma.auditLog.aggregate({
    where: {
      OR: [{ buildingId }, { buildingId: null }],
      createdAt: { gte: from, lte: to },
    },
    _count: true,
    _max: { createdAt: true },
  });

  const parts = [
    `tpl:${AUDIT_SLICE_TEMPLATE_VERSION}`,
    `bld:${buildingId}`,
    `range:${range}`,
    `events:${agg._count}/${agg._max.createdAt?.toISOString() ?? "none"}`,
  ];
  return sha256(parts.join("|"));
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
