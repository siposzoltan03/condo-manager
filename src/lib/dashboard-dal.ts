import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";

// ─── Board dashboard data ──────────────────────────────────────────────────

export interface BoardKPI {
  /** Current operating cash balance (Ft). Heuristic: ASSET accounts named like "Operating"/"Current Fund". */
  operatingBalance: number;
  /** Reserve fund balance (Ft). Heuristic: ASSET accounts named like "Reserve". */
  reserveBalance: number;
  /** Reserve fund target (Ft). Hardcoded for now — TODO: move to Building.reserveTarget. */
  reserveTarget: number;
  /** Open + acknowledged maintenance ticket count. */
  openTicketCount: number;
  /** Subset of openTicketCount with urgency = URGENT or CRITICAL. */
  urgentTicketCount: number;
  /** Sum of UNPAID + OVERDUE MonthlyCharge.amount for this building (Ft). */
  outstandingCharges: number;
  /** Distinct units with arrears. */
  outstandingUnitsCount: number;
}

export interface CashFlowMonth {
  /** "YYYY-MM" */
  month: string;
  /** Three-letter Hungarian month abbreviation, uppercase. */
  label: string;
  /** Net cents = income - expense for this month, in Ft (not cents). */
  net: number;
}

export interface BoardActiveVote {
  id: string;
  title: string;
  options: { id: string; label: string; percent: number; type: "y" | "n" | "a" | "x" }[];
  /** Quorum reached as a percent of total ownership shares. */
  quorumPercent: number;
  /** Statutory threshold the vote needs to pass (e.g. 50 / 60 / 66 / 80). */
  quorumThreshold: number;
  /** Days remaining until deadline; negative if overdue. */
  daysRemaining: number;
}

export interface BoardSummary {
  totalUnits: number;
  /** Distinct people in UserBuilding for this building. */
  totalUsers: number;
  /** Sum of ownershipShare across units; 1.0 = 100%. */
  ownershipShareRecorded: number;
  /** Payment rate for the current month (0..1). */
  paymentRate: number;
  /** Distinct units with at least one UNPAID/OVERDUE charge. */
  arrearsUnits: number;
  /** ISO date string of next scheduled meeting, or null. */
  nextMeetingDate: string | null;
}

export interface BoardPerson {
  id: string;
  name: string;
  /** Localised role label key (resolved on the client). */
  role: string;
  isChair?: boolean;
  unitLabel?: string | null;
}

export interface BoardMeeting {
  id: string;
  title: string;
  /** ISO datetime. */
  startsAt: string;
  location: string | null;
}

export interface BoardContractor {
  id: string;
  name: string;
  specialty: string;
  averageRating: number | null;
  totalJobs: number;
}

export interface BoardActivityItem {
  id: string;
  /** Module-specific kind, drives the icon. */
  kind: "finance" | "voting" | "maintenance" | "documents" | "communication" | "system";
  /** Severity hint for the icon background. */
  severity: "danger" | "warn" | "ok" | "neutral";
  title: string;
  body: string;
  /** Trailing tag like "/ MNT-088 · sürgős". */
  tag: string | null;
  /** ISO datetime when the event happened. Client renders "X perce" / "X órája" / "TEGNAP". */
  occurredAt: string;
}

export interface BoardDashboardData {
  kpi: BoardKPI;
  cashFlow: CashFlowMonth[];
  cashFlow_incomeYTD: number;
  cashFlow_expenseYTD: number;
  activeVote: BoardActiveVote | null;
  summary: BoardSummary;
  boardMembers: BoardPerson[];
  todaysMeetings: BoardMeeting[];
  contractors: BoardContractor[];
  recentActivity: BoardActivityItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const HU_MONTH = ["JAN", "FEB", "MÁR", "ÁPR", "MÁJ", "JÚN", "JÚL", "AUG", "SZE", "OKT", "NOV", "DEC"];

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return HU_MONTH[d.getMonth()];
}

// ─── Main loader ───────────────────────────────────────────────────────────

export const getBoardDashboard = cache(async (): Promise<BoardDashboardData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "view.building.finance");

  // Compute month-window boundaries.
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 7, 1);
  const currentMonthKey = ymKey(now);

  const [
    operatingAccounts,
    reserveAccounts,
    openTickets,
    urgentTickets,
    chargesByUnit,
    paidThisMonth,
    totalThisMonth,
    totalUnits,
    totalUsers,
    ownership,
    activeVoteRow,
    boardMemberships,
    upcomingMeetings,
    todayMeetings,
    contractorRows,
    recentLedgerForChart,
    recentTickets,
    recentVotes,
    recentDocs,
    recentAnnouncements,
  ] = await Promise.all([
    // Operating cash accounts: ASSET type, name contains "Current" or "Operating" (Hungarian: Folyó / Operatív).
    prisma.account.findMany({
      where: {
        buildingId,
        type: "ASSET",
        OR: [
          { name: { contains: "Current", mode: "insensitive" } },
          { name: { contains: "Operating", mode: "insensitive" } },
          { name: { contains: "Folyó", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
    prisma.account.findMany({
      where: {
        buildingId,
        type: "ASSET",
        OR: [
          { name: { contains: "Reserve", mode: "insensitive" } },
          { name: { contains: "Tartalék", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
    prisma.maintenanceTicket.count({
      where: {
        buildingId,
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
      },
    }),
    prisma.maintenanceTicket.count({
      where: {
        buildingId,
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
        urgency: { in: ["HIGH", "CRITICAL"] },
      },
    }).catch(() => 0),
    prisma.monthlyCharge.findMany({
      where: { unit: { buildingId }, status: { in: ["UNPAID", "OVERDUE"] } },
      select: { amount: true, unitId: true },
    }),
    prisma.monthlyCharge.count({
      where: { unit: { buildingId }, month: currentMonthKey, status: "PAID" },
    }),
    prisma.monthlyCharge.count({
      where: { unit: { buildingId }, month: currentMonthKey },
    }),
    prisma.unit.count({ where: { buildingId } }),
    prisma.userBuilding.count({ where: { buildingId, isActive: true } }),
    prisma.unit.aggregate({
      where: { buildingId },
      _sum: { ownershipShare: true },
    }),
    // Most recently-opened active vote.
    prisma.vote.findFirst({
      where: { buildingId, status: "OPEN" },
      include: { ballots: { select: { weight: true, optionId: true } }, options: true },
      orderBy: { createdAt: "desc" },
    }),
    // Board members (BOARD_MEMBER role) + their unit info.
    prisma.userBuilding.findMany({
      where: { buildingId, role: "BOARD_MEMBER", isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            unitUsers: {
              where: { unit: { buildingId } },
              select: { unit: { select: { number: true, floor: true } } },
              take: 1,
            },
          },
        },
      },
      take: 6,
    }),
    // Upcoming meetings within 30 days.
    prisma.meeting.findMany({
      where: { buildingId, date: { gte: now, lte: new Date(Date.now() + 30 * 86400_000) } },
      select: { id: true, title: true, date: true, time: true, location: true },
      orderBy: { date: "asc" },
      take: 5,
    }),
    // Today's meetings (used for "Mai találkozók").
    prisma.meeting.findMany({
      where: {
        buildingId,
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
      select: { id: true, title: true, date: true, time: true, location: true },
      orderBy: { date: "asc" },
    }),
    prisma.contractor.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        ratings: { select: { rating: true } },
        tickets: { select: { id: true } },
      },
    }),
    // Cash flow: 8 most recent months of ledger entries.
    prisma.ledgerEntry.findMany({
      where: {
        date: { gte: eightMonthsAgo },
        OR: [
          { debitAccount: { buildingId, type: "EXPENSE" } },
          { creditAccount: { buildingId, type: "INCOME" } },
        ],
      },
      select: {
        date: true,
        amount: true,
        debitAccount: { select: { type: true, buildingId: true } },
        creditAccount: { select: { type: true, buildingId: true } },
      },
      orderBy: { date: "asc" },
    }),
    // Recent activity sources — last 24 hours.
    prisma.maintenanceTicket.findMany({
      where: { buildingId, updatedAt: { gte: new Date(Date.now() - 86400_000) } },
      select: { id: true, title: true, status: true, urgency: true, trackingNumber: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.vote.findMany({
      where: { buildingId, updatedAt: { gte: new Date(Date.now() - 86400_000) } },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.document.findMany({
      where: {
        category: { buildingId },
        createdAt: { gte: new Date(Date.now() - 86400_000) },
      },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.channelMessage.findMany({
      where: {
        channel: { buildingId, kind: "ANNOUNCEMENT" },
        kind: "POST",
        createdAt: { gte: new Date(Date.now() - 86400_000) },
        deletedAt: null,
      },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  // ─── KPI calc ──────────────────────────────────────────────────────────────

  const operatingAccountIds = operatingAccounts.map((a) => a.id);
  const reserveAccountIds = reserveAccounts.map((a) => a.id);

  const [opDebits, opCredits, resDebits, resCredits] = await Promise.all([
    operatingAccountIds.length
      ? prisma.ledgerEntry.aggregate({
          where: { debitAccountId: { in: operatingAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    operatingAccountIds.length
      ? prisma.ledgerEntry.aggregate({
          where: { creditAccountId: { in: operatingAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    reserveAccountIds.length
      ? prisma.ledgerEntry.aggregate({
          where: { debitAccountId: { in: reserveAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    reserveAccountIds.length
      ? prisma.ledgerEntry.aggregate({
          where: { creditAccountId: { in: reserveAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const operatingBalance =
    Number(opDebits._sum.amount ?? 0) - Number(opCredits._sum.amount ?? 0);
  const reserveBalance =
    Number(resDebits._sum.amount ?? 0) - Number(resCredits._sum.amount ?? 0);

  const outstandingCharges = chargesByUnit.reduce(
    (sum, c) => sum + Number(c.amount),
    0,
  );
  const outstandingUnitsCount = new Set(chargesByUnit.map((c) => c.unitId)).size;

  // ─── Cash flow chart aggregation ───────────────────────────────────────────

  const monthlyNet = new Map<string, number>();
  const monthlyIncome = new Map<string, number>();
  const monthlyExpense = new Map<string, number>();
  let incomeYTD = 0;
  let expenseYTD = 0;
  for (const e of recentLedgerForChart) {
    const key = ymKey(e.date);
    const amt = Number(e.amount);
    if (e.creditAccount?.type === "INCOME" && e.creditAccount.buildingId === buildingId) {
      monthlyIncome.set(key, (monthlyIncome.get(key) ?? 0) + amt);
      monthlyNet.set(key, (monthlyNet.get(key) ?? 0) + amt);
      if (e.date >= yearStart) incomeYTD += amt;
    } else if (e.debitAccount?.type === "EXPENSE" && e.debitAccount.buildingId === buildingId) {
      monthlyExpense.set(key, (monthlyExpense.get(key) ?? 0) + amt);
      monthlyNet.set(key, (monthlyNet.get(key) ?? 0) - amt);
      if (e.date >= yearStart) expenseYTD += amt;
    }
  }

  const cashFlow: CashFlowMonth[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = ymKey(d);
    cashFlow.push({ month: key, label: monthLabel(d), net: monthlyNet.get(key) ?? 0 });
  }

  // ─── Active vote tally ─────────────────────────────────────────────────────

  let activeVote: BoardActiveVote | null = null;
  if (activeVoteRow) {
    // Sum total share weights cast (across all options).
    const totalWeight = activeVoteRow.ballots.reduce(
      (s: number, b: { weight: unknown }) => s + Number(b.weight ?? 0),
      0,
    );

    // Group ballot weights by VoteOption.
    const byOption = new Map<string, number>();
    for (const b of activeVoteRow.ballots) {
      const w = Number(b.weight ?? 0);
      byOption.set(b.optionId, (byOption.get(b.optionId) ?? 0) + w);
    }
    // Heuristic option-type tagging for the bar colors:
    // labels that look like a yes/no/abstain pattern get y/n/a coloring,
    // anything else falls back to neutral 'x'.
    function typeFor(label: string): "y" | "n" | "a" | "x" {
      const l = label.toLowerCase();
      if (l.startsWith("igen") || l.includes("támog")) return "y";
      if (l.startsWith("nem") || l.includes("ellenez")) return "n";
      if (l.startsWith("tart") || l.includes("absten") || l.includes("abstain")) return "a";
      return "x";
    }
    const options = activeVoteRow.options.map((o: { id: string; label: string }) => ({
      id: o.id,
      label: o.label,
      percent:
        totalWeight > 0
          ? Math.round(((byOption.get(o.id) ?? 0) / totalWeight) * 100)
          : 0,
      type: typeFor(o.label),
    }));

    // Quorum vs total ownership shares (assumes ownership sums to 1).
    const totalShares = Number(ownership._sum.ownershipShare ?? 1);
    const quorumPercent =
      totalShares > 0 ? Math.round((totalWeight / totalShares) * 100) : 0;
    const quorumThreshold = activeVoteRow.majorityType === "TWO_THIRDS"
      ? 67
      : activeVoteRow.majorityType === "FOUR_FIFTHS"
        ? 80
        : 60;

    const deadline = activeVoteRow.deadline ?? null;
    const daysRemaining =
      deadline === null
        ? -1
        : Math.ceil((deadline.getTime() - Date.now()) / 86400_000);

    activeVote = {
      id: activeVoteRow.id,
      title: activeVoteRow.title,
      options,
      quorumPercent,
      quorumThreshold,
      daysRemaining,
    };
  }

  // ─── Summary panel ─────────────────────────────────────────────────────────

  const arrearsUnits = outstandingUnitsCount;
  const paymentRate = totalThisMonth > 0 ? paidThisMonth / totalThisMonth : 0;
  const ownershipShareRecorded = Number(ownership._sum.ownershipShare ?? 0);
  const nextMeetingDate = upcomingMeetings[0]?.date.toISOString() ?? null;

  // ─── People row ────────────────────────────────────────────────────────────

  const boardMembers: BoardPerson[] = boardMemberships.map((bm) => {
    const u0 = bm.user.unitUsers[0];
    return {
      id: bm.userId,
      name: bm.user.name,
      role: "BOARD_MEMBER",
      // isChair flag will land when the legal-alignment plan's UserBuilding.isChair migration runs.
      // For now everybody in BOARD_MEMBER is a peer.
      isChair: false,
      unitLabel: u0?.unit ? `${u0.unit.floor}.EM ${u0.unit.number}.` : null,
    };
  });

  const todaysMeetings: BoardMeeting[] = todayMeetings.map((m) => {
    const dt = new Date(m.date);
    const [hh, mm] = (m.time ?? "00:00").split(":");
    dt.setHours(Number(hh), Number(mm));
    return {
      id: m.id,
      title: m.title,
      startsAt: dt.toISOString(),
      location: m.location ?? null,
    };
  });

  const contractors: BoardContractor[] = contractorRows.map((c) => {
    const ratings = c.ratings;
    const avg =
      ratings.length > 0
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : null;
    return {
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      averageRating: avg,
      totalJobs: c.tickets.length,
    };
  });

  // ─── Recent activity feed ──────────────────────────────────────────────────

  const recentActivity: BoardActivityItem[] = [];
  for (const t of recentTickets) {
    const isUrgent = t.urgency === "HIGH" || t.urgency === "CRITICAL";
    recentActivity.push({
      id: `mnt-${t.id}`,
      kind: "maintenance",
      severity: isUrgent ? "danger" : "warn",
      title: `${t.title}`,
      body: `Állapot: ${t.status}`,
      tag: `/ ${t.trackingNumber}${isUrgent ? " · sürgős" : ""}`,
      occurredAt: t.updatedAt.toISOString(),
    });
  }
  for (const v of recentVotes) {
    recentActivity.push({
      id: `vot-${v.id}`,
      kind: "voting",
      severity: "neutral",
      title: v.title,
      body: `Állapot: ${v.status}`,
      tag: `/ VOTE-${v.id.slice(-6).toUpperCase()}`,
      occurredAt: v.updatedAt.toISOString(),
    });
  }
  for (const d of recentDocs) {
    recentActivity.push({
      id: `doc-${d.id}`,
      kind: "documents",
      severity: "neutral",
      title: `Új dokumentum · ${d.title}`,
      body: "",
      tag: `/ DOC-${d.id.slice(-6).toUpperCase()}`,
      occurredAt: d.createdAt.toISOString(),
    });
  }
  for (const a of recentAnnouncements) {
    recentActivity.push({
      id: `ann-${a.id}`,
      kind: "communication",
      severity: "neutral",
      title: `Hirdetmény · ${a.title ?? "Új hirdetmény"}`,
      body: "",
      tag: `/ HIRD-${a.id.slice(-6).toUpperCase()}`,
      occurredAt: a.createdAt.toISOString(),
    });
  }
  recentActivity.sort((x, y) => (x.occurredAt < y.occurredAt ? 1 : -1));

  return {
    kpi: {
      operatingBalance,
      reserveBalance,
      reserveTarget: 32_000_000,
      openTicketCount: openTickets,
      urgentTicketCount: urgentTickets,
      outstandingCharges,
      outstandingUnitsCount,
    },
    cashFlow,
    cashFlow_incomeYTD: incomeYTD,
    cashFlow_expenseYTD: expenseYTD,
    activeVote,
    summary: {
      totalUnits,
      totalUsers,
      ownershipShareRecorded,
      paymentRate,
      arrearsUnits,
      nextMeetingDate,
    },
    boardMembers,
    todaysMeetings,
    contractors,
    recentActivity: recentActivity.slice(0, 8),
  };
});

// ─── Followups: explicit Tasks UNION derived signals ──────────────────────

export interface FollowupItem {
  id: string;
  /** Task row, or a derived signal from another module. */
  source: "task" | "overdue-charge" | "unassigned-ticket" | "meeting-needs-minutes";
  title: string;
  /** Small subtitle (mono). */
  meta: string;
  /** Done | overdue | soon | neutral — drives the pill colour. */
  pill: "due" | "soon" | "neutral" | "ok";
  pillText: string;
  /** Set only for `source === "task"`. */
  taskId?: string;
  /** When clicked, navigate here (relative path, no locale). */
  href?: string;
}

export const getFollowups = cache(async (): Promise<FollowupItem[]> => {
  const { buildingId, userId } = await requireBuildingContext();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [tasks, overdueCharges, unassignedTickets, meetingsNeedingMinutes] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          buildingId,
          status: "OPEN",
          OR: [{ assigneeId: userId }, { assigneeId: null }],
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 12,
      }),
      // Overdue charges → 1 followup per affected unit (collapsed)
      prisma.monthlyCharge.findMany({
        where: {
          unit: { buildingId },
          status: { in: ["UNPAID", "OVERDUE"] },
          month: { lt: currentMonth },
        },
        select: { id: true, month: true, unitId: true, amount: true, unit: { select: { number: true, floor: true } } },
        take: 10,
      }),
      prisma.maintenanceTicket.findMany({
        where: { buildingId, status: "SUBMITTED", assignedContractorId: null },
        select: { id: true, title: true, urgency: true, createdAt: true, trackingNumber: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.meeting.findMany({
        where: {
          buildingId,
          date: { lt: now },
          OR: [{ minutes: null }, { minutes: "" }],
        },
        select: { id: true, title: true, date: true },
        orderBy: { date: "desc" },
        take: 4,
      }),
    ]);

  const items: FollowupItem[] = [];

  for (const t of tasks) {
    const isOverdue = t.dueDate ? t.dueDate < now : false;
    const days = t.dueDate
      ? Math.ceil((t.dueDate.getTime() - now.getTime()) / 86400_000)
      : null;
    items.push({
      id: `task-${t.id}`,
      source: "task",
      title: t.title,
      meta: t.body ?? "/ MANUÁLIS · TEENDŐ",
      pill: isOverdue ? "due" : days !== null && days <= 3 ? "soon" : "neutral",
      pillText:
        days === null
          ? "Heti"
          : isOverdue
            ? `Lejárt ${Math.abs(days)}N`
            : `${days} nap`,
      taskId: t.id,
      href: t.sourceEntityType && t.sourceEntityId
        ? `/${routeForEntity(t.sourceEntityType, t.sourceEntityId)}`
        : undefined,
    });
  }

  // Group overdue charges by unit so we don't spam one row per (unit, month).
  const byUnit = new Map<
    string,
    { unitNumber: string; floor: number; months: string[]; total: number }
  >();
  for (const c of overdueCharges) {
    const key = c.unitId;
    const u = c.unit;
    const acc = byUnit.get(key) ?? {
      unitNumber: u?.number ?? "?",
      floor: u?.floor ?? 0,
      months: [],
      total: 0,
    };
    acc.months.push(c.month);
    acc.total += Number(c.amount);
    byUnit.set(key, acc);
  }
  for (const [unitId, info] of byUnit) {
    items.push({
      id: `arrears-${unitId}`,
      source: "overdue-charge",
      title: `Hátralék · ${info.floor}.em ${info.unitNumber}.`,
      meta: `/ ${info.months.length} HÓ · ${Math.round(info.total).toLocaleString("hu-HU")} FT`,
      pill: "due",
      pillText: `Lejárt ${info.months.length}H`,
      href: `/finance/building?unit=${unitId}`,
    });
  }

  for (const t of unassignedTickets) {
    items.push({
      id: `ticket-${t.id}`,
      source: "unassigned-ticket",
      title: `Kiosztásra vár · ${t.title}`,
      meta: `/ ${t.trackingNumber} · ${t.urgency}`,
      pill: t.urgency === "HIGH" || t.urgency === "CRITICAL" ? "due" : "soon",
      pillText: t.urgency === "HIGH" || t.urgency === "CRITICAL" ? "Sürgős" : "Hozzárendel",
      href: `/maintenance`,
    });
  }

  for (const m of meetingsNeedingMinutes) {
    const days = Math.ceil((now.getTime() - m.date.getTime()) / 86400_000);
    items.push({
      id: `minutes-${m.id}`,
      source: "meeting-needs-minutes",
      title: `Jegyzőkönyv hiányzik · ${m.title}`,
      meta: `/ ${days} NAP MÚLVA TARTOTT KÖZGYŰLÉS`,
      pill: days > 14 ? "due" : "soon",
      pillText: days > 14 ? `Lejárt ${days}N` : `${days} napja`,
      href: `/voting/meetings`,
    });
  }

  return items.slice(0, 8);
});

// ─── Member dashboard (OWNER / RESIDENT / TENANT) ──────────────────────────

export interface MemberKPI {
  /** Outstanding balance summed across the user's owned/rented units (Ft, signed). */
  ownBalance: number;
  /** Distinct units the user owns/rents that have unpaid charges. */
  ownArrearsUnits: number;
  /** Open MaintenanceTickets where the user is the reporter. */
  ownOpenTickets: number;
  /** ISO datetime of the next upcoming meeting in this building, or null. */
  nextMeetingDate: string | null;
}

export interface MemberRecentAnnouncement {
  id: string;
  title: string;
  bodyExcerpt: string;
  createdAt: string;
  isRead: boolean;
}

export interface MemberOwnTicket {
  id: string;
  trackingNumber: string;
  title: string;
  status: string;
  urgency: string;
  updatedAt: string;
}

export interface MemberActiveVote {
  id: string;
  title: string;
  deadline: string;
  hasCast: boolean;
}

export interface MemberDashboardData {
  /** Effective member role for the current active building. */
  role: "OWNER" | "OWNER" | "TENANT";
  /** Has at least one OWNER-relationship UnitUser row → may cast votes, sees finance. */
  ownsAnyUnit: boolean;
  kpi: MemberKPI;
  announcements: MemberRecentAnnouncement[];
  ownTickets: MemberOwnTicket[];
  /** Open vote the user can cast on. Null for TENANT or when no open vote exists. */
  activeVote: MemberActiveVote | null;
  /** Chair-of-board contact card (or first board member as fallback). Null if none exist. */
  chair: { id: string; name: string } | null;
  /** Pinned documents matching common house-rules categories. Used by TENANT view. */
  houseRulesDoc: { id: string; title: string } | null;
}

export const getMemberDashboard = cache(async (): Promise<MemberDashboardData> => {
  const { buildingId, userId, role: buildingRole } = await requireBuildingContext();

  // Derive effective role: BuildingRole tells us platform privilege; UnitUser
  // relationships tell us whether the user owns or rents a unit.
  const unitMemberships = await prisma.unitUser.findMany({
    where: { userId, unit: { buildingId } },
    select: { unitId: true, relationship: true },
  });
  const ownsAnyUnit = unitMemberships.some((u) => u.relationship === "OWNER");
  const isTenant = buildingRole === "TENANT" || (!ownsAnyUnit && unitMemberships.some((u) => u.relationship === "TENANT"));
  const role: "OWNER" | "OWNER" | "TENANT" = isTenant
    ? "TENANT"
    : ownsAnyUnit
      ? "OWNER"
      : "OWNER";

  const ownedUnitIds = unitMemberships
    .filter((u) => u.relationship === "OWNER")
    .map((u) => u.unitId);

  const now = new Date();

  const [
    ownCharges,
    ownTicketCount,
    upcomingMeeting,
    recentAnnouncementRows,
    announcementReads,
    ownTicketRows,
    activeVoteForMember,
    boardMember,
    houseRulesCategoryDoc,
  ] = await Promise.all([
    ownedUnitIds.length
      ? prisma.monthlyCharge.findMany({
          where: { unitId: { in: ownedUnitIds }, status: { in: ["UNPAID", "OVERDUE"] } },
          select: { unitId: true, amount: true },
        })
      : Promise.resolve([] as { unitId: string; amount: import("@prisma/client/runtime/library").Decimal }[]),
    prisma.maintenanceTicket.count({
      where: {
        buildingId,
        reporterId: userId,
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
      },
    }),
    prisma.meeting.findFirst({
      where: { buildingId, date: { gte: now } },
      select: { id: true, date: true, title: true },
      orderBy: { date: "asc" },
    }),
    (() => {
      const audienceFilters: Prisma.ChannelMessageWhereInput[] = [
        { audience: { equals: Prisma.AnyNull } },
        { audience: { path: ["type"], equals: "all" } },
      ];
      if (role !== "TENANT") {
        audienceFilters.push({
          audience: { path: ["type"], equals: "specific_units" },
        });
      }
      if (buildingRole === "BOARD_MEMBER") {
        audienceFilters.push({
          audience: { path: ["type"], equals: "board_only" },
        });
      }
      return prisma.channelMessage.findMany({
        where: {
          channel: { buildingId, kind: "ANNOUNCEMENT" },
          kind: "POST",
          deletedAt: null,
          OR: audienceFilters,
        },
        select: { id: true, title: true, body: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 4,
      });
    })(),
    prisma.messageRead.findMany({
      where: {
        userId,
        message: {
          channel: { buildingId, kind: "ANNOUNCEMENT" },
        },
      },
      select: { messageId: true },
    }),
    prisma.maintenanceTicket.findMany({
      where: {
        buildingId,
        reporterId: userId,
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        trackingNumber: true,
        title: true,
        status: true,
        urgency: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    // Active vote (TENANT cannot vote, so skip the load entirely).
    isTenant
      ? Promise.resolve(null)
      : prisma.vote.findFirst({
          where: { buildingId, status: "OPEN", deadline: { gte: now } },
          select: {
            id: true,
            title: true,
            deadline: true,
            ballots: {
              where: { unitId: { in: ownedUnitIds } },
              select: { id: true },
            },
          },
          orderBy: { deadline: "asc" },
        }),
    // First active board member — used as the "contact your chair" card.
    prisma.userBuilding.findFirst({
      where: { buildingId, role: "BOARD_MEMBER", isActive: true },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // House-rules doc: first PUBLIC document in a category named like Házirend / SZMSZ.
    prisma.document.findFirst({
      where: {
        category: { buildingId },
        visibility: "PUBLIC",
        OR: [
          { title: { contains: "házirend", mode: "insensitive" } },
          { title: { contains: "szmsz", mode: "insensitive" } },
          { category: { name: { contains: "házirend", mode: "insensitive" } } },
          { category: { name: { contains: "szmsz", mode: "insensitive" } } },
        ],
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const readSet = new Set(announcementReads.map((r) => r.messageId));

  const ownBalance = ownCharges.reduce((sum, c) => sum + Number(c.amount), 0);
  const ownArrearsUnits = new Set(ownCharges.map((c) => c.unitId)).size;

  const announcements: MemberRecentAnnouncement[] = recentAnnouncementRows.map((a) => {
    const body = a.body ?? "";
    return {
      id: a.id,
      title: a.title ?? "",
      bodyExcerpt: body.slice(0, 140) + (body.length > 140 ? "…" : ""),
      createdAt: a.createdAt.toISOString(),
      isRead: readSet.has(a.id),
    };
  });

  const ownTickets: MemberOwnTicket[] = ownTicketRows.map((t) => ({
    id: t.id,
    trackingNumber: t.trackingNumber,
    title: t.title,
    status: t.status,
    urgency: t.urgency,
    updatedAt: t.updatedAt.toISOString(),
  }));

  const activeVote: MemberActiveVote | null =
    activeVoteForMember && "deadline" in activeVoteForMember
      ? {
          id: activeVoteForMember.id,
          title: activeVoteForMember.title,
          deadline: activeVoteForMember.deadline.toISOString(),
          hasCast: activeVoteForMember.ballots.length > 0,
        }
      : null;

  return {
    role,
    ownsAnyUnit,
    kpi: {
      ownBalance,
      ownArrearsUnits,
      ownOpenTickets: ownTicketCount,
      nextMeetingDate: upcomingMeeting?.date.toISOString() ?? null,
    },
    announcements,
    ownTickets,
    activeVote,
    chair: boardMember
      ? { id: boardMember.user.id, name: boardMember.user.name }
      : null,
    houseRulesDoc: houseRulesCategoryDoc
      ? { id: houseRulesCategoryDoc.id, title: houseRulesCategoryDoc.title }
      : null,
  };
});

function routeForEntity(entityType: string, entityId: string): string {
  switch (entityType) {
    case "MaintenanceTicket":
      return `maintenance/${entityId}`;
    case "Meeting":
      return `voting/meetings`;
    case "Vote":
      return `voting/${entityId}`;
    case "Document":
      return `documents/${entityId}`;
    default:
      return "dashboard";
  }
}

/**
 * Active building name — used by the BoardDashboard header. Tiny
 * single-column lookup; lives here because it's only consumed by the
 * dashboard page.
 */
export async function getBuildingName(buildingId: string) {
  return prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true },
  });
}
