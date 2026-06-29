import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ActiveVoteData {
  id: string;
  title: string;
  description: string | null;
  /** Hungarian-friendly id stamp like "HAT-2026-014". */
  reference: string;
  /** ISO datetime when the vote started accepting ballots. */
  createdAt: string;
  deadline: string;
  /** Statutory majority — drives the quorum threshold and the support threshold. */
  majorityType: "SIMPLE_MAJORITY" | "TWO_THIRDS" | "FOUR_FIFTHS" | "UNANIMOUS" | "PLURALITY";
  isSecret: boolean;
  /** Sum of cast ballot weights. */
  castShares: number;
  /** Sum of ownership shares of all units in the building (typically 1.0). */
  totalShares: number;
  /** Required quorum % of total shares (e.g. 51 for SIMPLE, 67 for TWO_THIRDS, 80 for FOUR_FIFTHS, 100 for UNANIMOUS). */
  quorumThresholdPct: number;
  /** Required support % of cast shares — same number as quorumThresholdPct for non-pluralities. */
  supportThresholdPct: number;
  /** Current support % across cast ballots that picked the first option (Igen). */
  currentSupportPct: number;
  /** Number of units that have cast a ballot. */
  unitsVoted: number;
  totalUnits: number;
  options: {
    id: string;
    label: string;
    sortOrder: number;
    /** Set when this is a contractor-award vote option (null for "Egyik sem"). */
    bid: { amount: number; etaDays: number } | null;
  }[];
  /** True when the vote decides a marketplace bid award (options are bid cards). */
  isAwardVote: boolean;
  /** The current user's combined ownership share across all owned units. */
  userOwnershipShare: number;
  /** Whether the current user has already cast on this vote (for any of their owned units). */
  hasUserCast: boolean;
  /** When user has cast, which option id was picked. Used to highlight the chosen option. */
  userPickedOptionId: string | null;
}

export interface PastVoteData {
  id: string;
  title: string;
  closedAt: string;
  result: "passed" | "failed" | "expired";
  optionTallies: { id: string; label: string; pct: number }[];
  /** When result === "expired", the quorum % the vote actually reached vs required. */
  achievedQuorumPct: number;
  requiredQuorumPct: number;
}

export interface OtherOpenPollData {
  id: string;
  title: string;
  daysRemaining: number;
  hoursRemaining: number;
  quorumPct: number;
  /** True when quorum is below required and < 24h remain. */
  isUrgent: boolean;
}

export interface NextMeetingData {
  id: string;
  title: string;
  /** ISO datetime, time component meaningful. */
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  rsvpCount: number;
  totalUnits: number;
  /** Up to 4 attendee initials (avatars) plus a +N indicator. */
  attendees: { initials: string; tone: "a" | "b" | "c" | "d" }[];
  totalAttendees: number;
}

export interface VotingHistoryStripEntry {
  /** "y" / "n" / "a" / "x" (live now) / null (didn't vote on that one). */
  kind: "y" | "n" | "a" | "x" | null;
}

export interface VotingOverviewData {
  /** Most-recently-deadlined OPEN vote. */
  active: ActiveVoteData | null;
  pastVotes: PastVoteData[];
  otherOpenPolls: OtherOpenPollData[];
  nextMeeting: NextMeetingData | null;
  /** Last 24 vote outcomes from the user's perspective for the participation strip. */
  userHistory: VotingHistoryStripEntry[];
  /** User's own participation rate as 0..1. */
  userParticipationRate: number;
  /** Total open vote count (for tab badge). */
  totalOpenCount: number;
  /** Total upcoming + recent meeting count (for tab badge). */
  totalMeetingCount: number;
  /** Total closed vote count (for tab badge). */
  totalHistoryCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function quorumThresholdFor(majorityType: ActiveVoteData["majorityType"]): number {
  switch (majorityType) {
    case "SIMPLE_MAJORITY":
      return 51; // statutory quorum: present units > 50% of total shares
    case "TWO_THIRDS":
      return 67;
    case "FOUR_FIFTHS":
      return 80;
    case "UNANIMOUS":
      return 100;
    case "PLURALITY":
      return 51;
  }
}

function supportThresholdFor(majorityType: ActiveVoteData["majorityType"]): number {
  switch (majorityType) {
    case "SIMPLE_MAJORITY":
      return 50; // strictly > 50% of present
    case "TWO_THIRDS":
      return 66.67;
    case "FOUR_FIFTHS":
      return 80;
    case "UNANIMOUS":
      return 100;
    case "PLURALITY":
      return 0; // most votes wins; no fixed threshold
  }
}

function buildReference(vote: { id: string; createdAt: Date }): string {
  const year = vote.createdAt.getFullYear();
  // Stable suffix from the vote id — last 3 chars of cuid, uppercased.
  const suffix = vote.id.slice(-3).toUpperCase();
  return `HAT-${year}-${suffix}`;
}

// ─── Main loader ──────────────────────────────────────────────────────────

export const getVotingOverview = cache(async (): Promise<VotingOverviewData> => {
  const { userId, buildingId } = await requireBuildingContext();

  const now = new Date();

  // Building total shares + user's ownership share — needed for both KPIs.
  const [totalSharesAgg, userUnitUsers, totalUnits] = await Promise.all([
    prisma.unit.aggregate({
      where: { buildingId },
      _sum: { ownershipShare: true },
    }),
    prisma.unitUser.findMany({
      where: { userId, unit: { buildingId }, relationship: "OWNER" },
      include: { unit: { select: { ownershipShare: true } } },
    }),
    prisma.unit.count({ where: { buildingId } }),
  ]);

  const totalShares = Number(totalSharesAgg._sum.ownershipShare ?? 1);
  const userOwnershipShare = userUnitUsers.reduce(
    (sum, uu) => sum + Number(uu.unit.ownershipShare),
    0,
  );
  const userUnitIds = userUnitUsers.map((uu) => uu.unitId);

  const [openVotes, pastVoteRows, nextMeetingRow, userBallots, totalHistoryCount] =
    await Promise.all([
      prisma.vote.findMany({
        where: { buildingId, status: "OPEN", deadline: { gte: now } },
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: { bid: { select: { amount: true, etaDays: true } } },
          },
          ballots: { select: { weight: true, optionId: true, unitId: true } },
        },
        orderBy: { deadline: "asc" },
      }),
      prisma.vote.findMany({
        where: { buildingId, status: "CLOSED" },
        include: {
          options: { orderBy: { sortOrder: "asc" } },
          ballots: { select: { weight: true, optionId: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.meeting.findFirst({
        where: { buildingId, date: { gte: now } },
        include: {
          rsvps: {
            where: { status: "ATTENDING" },
            include: { user: { select: { name: true } } },
            take: 4,
          },
          _count: { select: { rsvps: { where: { status: "ATTENDING" } } } },
        },
        orderBy: { date: "asc" },
      }),
      // Last 24 votes user could have voted on, with their ballot if any.
      prisma.vote.findMany({
        where: { buildingId, status: { in: ["OPEN", "CLOSED"] } },
        include: {
          options: { select: { id: true, sortOrder: true } },
          ballots: {
            where: userUnitIds.length > 0 ? { unitId: { in: userUnitIds } } : { id: "__never__" },
            select: { optionId: true, voteId: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
      prisma.vote.count({ where: { buildingId, status: "CLOSED" } }),
    ]);

  // ── Active vote (first OPEN, or null) ───────────────────────────────────
  const activeRow = openVotes[0] ?? null;
  let active: ActiveVoteData | null = null;

  if (activeRow) {
    const castShares = activeRow.ballots.reduce(
      (s, b) => s + Number(b.weight ?? 0),
      0,
    );
    const unitsVoted = new Set(activeRow.ballots.map((b) => b.unitId)).size;
    const userBallotForActive = activeRow.ballots.filter((b) =>
      userUnitIds.includes(b.unitId),
    );
    const userPickedOptionId =
      userBallotForActive.length > 0 ? userBallotForActive[0].optionId : null;
    const hasUserCast = userBallotForActive.length > 0;

    // Support % = % of cast shares that picked the first option (the "Igen" / yes-equivalent).
    const firstOptionId = activeRow.options[0]?.id;
    const yesShares = firstOptionId
      ? activeRow.ballots
          .filter((b) => b.optionId === firstOptionId)
          .reduce((s, b) => s + Number(b.weight ?? 0), 0)
      : 0;
    const currentSupportPct =
      totalShares > 0 ? Math.round((yesShares / totalShares) * 1000) / 10 : 0;

    active = {
      id: activeRow.id,
      title: activeRow.title,
      description: activeRow.description,
      reference: buildReference(activeRow),
      createdAt: activeRow.createdAt.toISOString(),
      deadline: activeRow.deadline.toISOString(),
      majorityType: activeRow.majorityType,
      isSecret: activeRow.isSecret,
      castShares,
      totalShares,
      quorumThresholdPct: quorumThresholdFor(activeRow.majorityType),
      supportThresholdPct: supportThresholdFor(activeRow.majorityType),
      currentSupportPct,
      unitsVoted,
      totalUnits,
      isAwardVote: activeRow.linkedPublicationId != null,
      options: activeRow.options.map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sortOrder,
        bid: o.bid
          ? { amount: Number(o.bid.amount), etaDays: o.bid.etaDays }
          : null,
      })),
      userOwnershipShare,
      hasUserCast,
      userPickedOptionId,
    };
  }

  // ── Other open polls (rest of OPEN votes besides the hero) ───────────────
  const otherOpenPolls: OtherOpenPollData[] = openVotes.slice(1).map((v) => {
    const cast = v.ballots.reduce((s, b) => s + Number(b.weight ?? 0), 0);
    const quorumPct = totalShares > 0 ? Math.round((cast / totalShares) * 100) : 0;
    const remainingMs = v.deadline.getTime() - now.getTime();
    const days = Math.max(0, Math.floor(remainingMs / 86_400_000));
    const hours = Math.max(0, Math.floor((remainingMs % 86_400_000) / 3_600_000));
    const required = quorumThresholdFor(v.majorityType);
    return {
      id: v.id,
      title: v.title,
      daysRemaining: days,
      hoursRemaining: hours,
      quorumPct,
      isUrgent: quorumPct < required && days < 1,
    };
  });

  // ── Past votes ──────────────────────────────────────────────────────────
  const pastVotes: PastVoteData[] = pastVoteRows.map((v) => {
    const totalCast = v.ballots.reduce((s, b) => s + Number(b.weight ?? 0), 0);
    const requiredQuorum = quorumThresholdFor(v.majorityType);
    const requiredSupport = supportThresholdFor(v.majorityType);
    const achievedQuorumPct = totalShares > 0 ? Math.round((totalCast / totalShares) * 100) : 0;
    const tally = v.options.map((o) => {
      const sum = v.ballots
        .filter((b) => b.optionId === o.id)
        .reduce((s, b) => s + Number(b.weight ?? 0), 0);
      const pct = totalCast > 0 ? Math.round((sum / totalCast) * 100) : 0;
      return { id: o.id, label: o.label, pct, weight: sum };
    });

    let result: "passed" | "failed" | "expired" = "failed";
    if (achievedQuorumPct < requiredQuorum) {
      result = "expired";
    } else {
      const yesShare = tally[0]?.weight ?? 0;
      const yesPctOfTotal =
        totalShares > 0 ? (yesShare / totalShares) * 100 : 0;
      result = yesPctOfTotal >= requiredSupport ? "passed" : "failed";
    }

    return {
      id: v.id,
      title: v.title,
      closedAt: v.updatedAt.toISOString(),
      result,
      optionTallies: tally.map(({ id, label, pct }) => ({ id, label, pct })),
      achievedQuorumPct,
      requiredQuorumPct: requiredQuorum,
    };
  });

  // ── Next meeting ────────────────────────────────────────────────────────
  const palette: NextMeetingData["attendees"][number]["tone"][] = ["a", "b", "c", "d"];
  let nextMeeting: NextMeetingData | null = null;
  if (nextMeetingRow) {
    const [hh, mm] = (nextMeetingRow.time ?? "00:00").split(":");
    const startsAt = new Date(nextMeetingRow.date);
    startsAt.setHours(Number(hh), Number(mm));
    nextMeeting = {
      id: nextMeetingRow.id,
      title: nextMeetingRow.title,
      startsAt: startsAt.toISOString(),
      endsAt: null,
      location: nextMeetingRow.location ?? null,
      rsvpCount: nextMeetingRow._count.rsvps,
      totalUnits,
      attendees: nextMeetingRow.rsvps.slice(0, 4).map((r, i) => ({
        initials: r.user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        tone: palette[i % palette.length],
      })),
      totalAttendees: nextMeetingRow._count.rsvps,
    };
  }

  // ── User history strip ──────────────────────────────────────────────────
  const userHistory: VotingHistoryStripEntry[] = userBallots.map((v) => {
    const ballot = v.ballots[0];
    if (!ballot) {
      // User didn't cast on a vote where they could have.
      return { kind: v.status === "OPEN" ? null : null };
    }
    if (v.status === "OPEN") return { kind: "x" };
    const opts = v.options.sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = opts.findIndex((o) => o.id === ballot.optionId);
    if (idx === 0) return { kind: "y" };
    if (idx === 1) return { kind: "n" };
    return { kind: "a" };
  });

  // Pad history to exactly 24 with null entries at the right (oldest end).
  while (userHistory.length < 24) userHistory.push({ kind: null });

  const possible = userBallots.length;
  const cast = userBallots.filter((v) => v.ballots.length > 0).length;
  const userParticipationRate = possible > 0 ? cast / possible : 0;

  return {
    active,
    pastVotes,
    otherOpenPolls,
    nextMeeting,
    userHistory,
    userParticipationRate,
    totalOpenCount: openVotes.length,
    totalMeetingCount: nextMeetingRow ? 1 : 0,
    totalHistoryCount,
  };
});

// ─── Meetings list ────────────────────────────────────────────────────────

export interface MeetingListItem {
  id: string;
  title: string;
  description: string | null;
  /** ISO with time. */
  startsAt: string;
  location: string | null;
  isRepeated: boolean;
  hasMinutes: boolean;
  /** ATTENDING / NOT_ATTENDING / PROXY / null. */
  myRsvp: "ATTENDING" | "NOT_ATTENDING" | "PROXY" | null;
  attending: number;
  notAttending: number;
  proxy: number;
  totalUnits: number;
  voteCount: number;
  agendaCount: number;
}

export interface MeetingListData {
  upcoming: MeetingListItem[];
  past: MeetingListItem[];
  nextMeetingId: string | null;
  totalCount: number;
}

export const getMeetingList = cache(async (): Promise<MeetingListData> => {
  const { userId, buildingId } = await requireBuildingContext();

  const [meetings, totalUnits] = await Promise.all([
    prisma.meeting.findMany({
      where: { buildingId },
      include: {
        rsvps: { select: { userId: true, status: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { date: "desc" },
      take: 60,
    }),
    prisma.unit.count({ where: { buildingId } }),
  ]);

  const now = new Date();

  const items: MeetingListItem[] = meetings.map((m) => {
    const [hh, mm] = (m.time ?? "00:00").split(":");
    const startsAt = new Date(m.date);
    startsAt.setHours(Number(hh), Number(mm));

    const attending = m.rsvps.filter((r) => r.status === "ATTENDING").length;
    const notAttending = m.rsvps.filter((r) => r.status === "NOT_ATTENDING").length;
    const proxy = m.rsvps.filter((r) => r.status === "PROXY").length;
    const myRsvp =
      (m.rsvps.find((r) => r.userId === userId)?.status as
        | "ATTENDING"
        | "NOT_ATTENDING"
        | "PROXY"
        | undefined) ?? null;
    const agendaArr = Array.isArray(m.agenda) ? m.agenda : [];

    return {
      id: m.id,
      title: m.title,
      description: m.description,
      startsAt: startsAt.toISOString(),
      location: m.location ?? null,
      isRepeated: m.isRepeated,
      hasMinutes: !!m.minutes,
      myRsvp,
      attending,
      notAttending,
      proxy,
      totalUnits,
      voteCount: m._count.votes,
      agendaCount: agendaArr.length,
    };
  });

  const upcoming = items
    .filter((m) => new Date(m.startsAt) >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = items.filter((m) => new Date(m.startsAt) < now);

  return {
    upcoming,
    past,
    nextMeetingId: upcoming[0]?.id ?? null,
    totalCount: items.length,
  };
});

// ─── Voting history ───────────────────────────────────────────────────────

export interface VotingHistoryItem {
  id: string;
  title: string;
  description: string | null;
  reference: string;
  closedAt: string;
  result: "passed" | "failed" | "expired";
  majorityType: ActiveVoteData["majorityType"];
  isSecret: boolean;
  totalCastPct: number;
  requiredQuorumPct: number;
  yesPct: number;
  noPct: number;
  abstainPct: number;
  optionTallies: { id: string; label: string; pct: number; weight: number }[];
  /** What the current user picked, if any. null if didn't vote / secret. */
  userChoiceLabel: string | null;
  hasMinutes: boolean;
}

export interface VotingHistoryData {
  items: VotingHistoryItem[];
  totalCount: number;
  passedCount: number;
  failedCount: number;
  expiredCount: number;
}

export const getVotingHistory = cache(async (): Promise<VotingHistoryData> => {
  const { userId, buildingId } = await requireBuildingContext();

  const [rows, totalSharesAgg, userUnitUsers] = await Promise.all([
    prisma.vote.findMany({
      where: { buildingId, status: "CLOSED" },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        ballots: { select: { weight: true, optionId: true, unitId: true } },
        meeting: { select: { id: true, minutes: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.unit.aggregate({
      where: { buildingId },
      _sum: { ownershipShare: true },
    }),
    prisma.unitUser.findMany({
      where: { userId, unit: { buildingId }, relationship: "OWNER" },
      select: { unitId: true },
    }),
  ]);

  const totalShares = Number(totalSharesAgg._sum.ownershipShare ?? 1);
  const userUnitIds = new Set(userUnitUsers.map((uu) => uu.unitId));

  let passedCount = 0;
  let failedCount = 0;
  let expiredCount = 0;

  const items: VotingHistoryItem[] = rows.map((v) => {
    const totalCast = v.ballots.reduce((s, b) => s + Number(b.weight ?? 0), 0);
    const requiredQuorum = quorumThresholdFor(v.majorityType);
    const requiredSupport = supportThresholdFor(v.majorityType);
    const totalCastPct = totalShares > 0 ? Math.round((totalCast / totalShares) * 100) : 0;

    const tally = v.options.map((o) => {
      const sum = v.ballots
        .filter((b) => b.optionId === o.id)
        .reduce((s, b) => s + Number(b.weight ?? 0), 0);
      const pct = totalCast > 0 ? Math.round((sum / totalCast) * 100) : 0;
      return { id: o.id, label: o.label, pct, weight: sum };
    });

    let result: "passed" | "failed" | "expired" = "failed";
    if (totalCastPct < requiredQuorum) {
      result = "expired";
    } else {
      const yesShare = tally[0]?.weight ?? 0;
      const yesPctOfTotal = totalShares > 0 ? (yesShare / totalShares) * 100 : 0;
      result = yesPctOfTotal >= requiredSupport ? "passed" : "failed";
    }

    if (result === "passed") passedCount++;
    else if (result === "failed") failedCount++;
    else expiredCount++;

    const userBallot = v.ballots.find((b) => userUnitIds.has(b.unitId));
    const userChoiceLabel = userBallot
      ? (v.options.find((o) => o.id === userBallot.optionId)?.label ?? null)
      : null;

    return {
      id: v.id,
      title: v.title,
      description: v.description,
      reference: buildReference(v),
      closedAt: v.updatedAt.toISOString(),
      result,
      majorityType: v.majorityType,
      isSecret: v.isSecret,
      totalCastPct,
      requiredQuorumPct: requiredQuorum,
      yesPct: tally[0]?.pct ?? 0,
      noPct: tally[1]?.pct ?? 0,
      abstainPct: tally[2]?.pct ?? 0,
      optionTallies: tally,
      userChoiceLabel: v.isSecret ? null : userChoiceLabel,
      hasMinutes: !!v.meeting?.minutes,
    };
  });

  return {
    items,
    totalCount: items.length,
    passedCount,
    failedCount,
    expiredCount,
  };
});

// ─── Proxy overview ───────────────────────────────────────────────────────

export interface ProxyAssignmentItem {
  id: string;
  /** Counterparty (the other side of the proxy). */
  counterpartyId: string;
  counterpartyName: string;
  counterpartyEmail: string | null;
  /** "outgoing" = current user granted to someone; "incoming" = someone granted to current user. */
  direction: "outgoing" | "incoming";
  /** "general" (all votes) or specific vote title. */
  scopeLabel: string;
  scopeVoteId: string | null;
  validFrom: string;
  validUntil: string | null;
  status: "active" | "expired" | "scheduled";
  createdAt: string;
}

export interface ProxyCandidateUser {
  id: string;
  name: string;
  email: string;
  /** Total ownership share across this user's owned units in the building. */
  ownershipShare: number;
}

export interface ProxyOverviewData {
  outgoing: ProxyAssignmentItem[];
  incoming: ProxyAssignmentItem[];
  /** Other users in the building this user can grant proxy to. */
  candidates: ProxyCandidateUser[];
  /** Open vote ids+titles for scoping a specific proxy. */
  openVotes: { id: string; title: string }[];
  /** Next meeting (for the "give proxy for next meeting" CTA). */
  nextMeeting: { id: string; title: string; startsAt: string } | null;
  userOwnershipShare: number;
  isOwner: boolean;
}

export const getProxyOverview = cache(async (): Promise<ProxyOverviewData> => {
  const { userId, buildingId } = await requireBuildingContext();
  const now = new Date();

  const [outgoingRows, incomingRows, buildingUsers, openVotes, nextMeetingRow, userUnitUsers] =
    await Promise.all([
      prisma.proxyAssignment.findMany({
        where: { grantorId: userId },
        include: {
          grantee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.proxyAssignment.findMany({
        where: { granteeId: userId },
        include: {
          grantor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.userBuilding.findMany({
        where: { buildingId, userId: { not: userId } },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              unitUsers: {
                where: { unit: { buildingId }, relationship: "OWNER" },
                select: { unit: { select: { ownershipShare: true } } },
              },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
        take: 100,
      }),
      prisma.vote.findMany({
        where: { buildingId, status: "OPEN", deadline: { gte: now } },
        select: { id: true, title: true },
        orderBy: { deadline: "asc" },
      }),
      prisma.meeting.findFirst({
        where: { buildingId, date: { gte: now } },
        select: { id: true, title: true, date: true, time: true },
        orderBy: { date: "asc" },
      }),
      prisma.unitUser.findMany({
        where: { userId, unit: { buildingId }, relationship: "OWNER" },
        include: { unit: { select: { ownershipShare: true } } },
      }),
    ]);

  // Resolve scope vote titles.
  const scopedVoteIds = [
    ...outgoingRows.map((p) => p.voteId),
    ...incomingRows.map((p) => p.voteId),
  ].filter((id): id is string => Boolean(id));
  const scopedVotes =
    scopedVoteIds.length > 0
      ? await prisma.vote.findMany({
          where: { id: { in: Array.from(new Set(scopedVoteIds)) } },
          select: { id: true, title: true },
        })
      : [];
  const voteTitleMap = new Map(scopedVotes.map((v) => [v.id, v.title]));

  function statusOf(p: { validFrom: Date; validUntil: Date | null }): ProxyAssignmentItem["status"] {
    if (p.validFrom > now) return "scheduled";
    if (p.validUntil && p.validUntil < now) return "expired";
    return "active";
  }

  const outgoing: ProxyAssignmentItem[] = outgoingRows.map((p) => ({
    id: p.id,
    counterpartyId: p.grantee.id,
    counterpartyName: p.grantee.name,
    counterpartyEmail: p.grantee.email ?? null,
    direction: "outgoing",
    scopeLabel: p.voteId ? voteTitleMap.get(p.voteId) ?? "—" : "general",
    scopeVoteId: p.voteId ?? null,
    validFrom: p.validFrom.toISOString(),
    validUntil: p.validUntil?.toISOString() ?? null,
    status: statusOf(p),
    createdAt: p.createdAt.toISOString(),
  }));

  const incoming: ProxyAssignmentItem[] = incomingRows.map((p) => ({
    id: p.id,
    counterpartyId: p.grantor.id,
    counterpartyName: p.grantor.name,
    counterpartyEmail: p.grantor.email ?? null,
    direction: "incoming",
    scopeLabel: p.voteId ? voteTitleMap.get(p.voteId) ?? "—" : "general",
    scopeVoteId: p.voteId ?? null,
    validFrom: p.validFrom.toISOString(),
    validUntil: p.validUntil?.toISOString() ?? null,
    status: statusOf(p),
    createdAt: p.createdAt.toISOString(),
  }));

  const candidates: ProxyCandidateUser[] = buildingUsers
    .map((ub) => ({
      id: ub.user.id,
      name: ub.user.name,
      email: ub.user.email,
      ownershipShare: ub.user.unitUsers.reduce(
        (sum, uu) => sum + Number(uu.unit.ownershipShare),
        0,
      ),
    }))
    .filter((c) => c.id !== userId);

  let nextMeeting: ProxyOverviewData["nextMeeting"] = null;
  if (nextMeetingRow) {
    const [hh, mm] = (nextMeetingRow.time ?? "00:00").split(":");
    const startsAt = new Date(nextMeetingRow.date);
    startsAt.setHours(Number(hh), Number(mm));
    nextMeeting = {
      id: nextMeetingRow.id,
      title: nextMeetingRow.title,
      startsAt: startsAt.toISOString(),
    };
  }

  const userOwnershipShare = userUnitUsers.reduce(
    (sum, uu) => sum + Number(uu.unit.ownershipShare),
    0,
  );

  return {
    outgoing,
    incoming,
    candidates,
    openVotes: openVotes.map((v) => ({ id: v.id, title: v.title })),
    nextMeeting,
    userOwnershipShare,
    isOwner: userUnitUsers.length > 0,
  };
});

// ─── Pending board resignations ───────────────────────────────────────────

export interface PendingResignationItem {
  id: string;
  residentName: string;
  residentInitials: string;
  oldRole: string;
  reason: string | null;
  meetingId: string | null;
  meetingDateISO: string | null;
  submittedAtISO: string;
  /** True when the viewer is the user who submitted — they can't ack themselves. */
  isOwn: boolean;
}

export interface PendingResignationsData {
  items: PendingResignationItem[];
  isBoardPlus: boolean;
}

function _initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const getPendingResignations = cache(
  async (): Promise<PendingResignationsData> => {
    const { userId, buildingId, role } = await requireBuildingContext();
    const isBoardPlus =
      role === "BOARD_MEMBER" || role === "ADMIN" || role === "SUPER_ADMIN";

    if (!isBoardPlus) {
      return { items: [], isBoardPlus: false };
    }

    const rows = await prisma.boardResignation.findMany({
      where: {
        status: "PENDING",
        userBuilding: { buildingId },
      },
      include: {
        userBuilding: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        pendingAgenda: {
          include: {
            attachedMeeting: { select: { id: true, date: true } },
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        residentName: r.userBuilding.user.name,
        residentInitials: _initialsOf(r.userBuilding.user.name),
        oldRole: r.userBuilding.role,
        reason: r.reason,
        meetingId: r.pendingAgenda?.attachedMeeting?.id ?? null,
        meetingDateISO:
          r.pendingAgenda?.attachedMeeting?.date.toISOString() ?? null,
        submittedAtISO: r.submittedAt.toISOString(),
        isOwn: r.userBuilding.user.id === userId,
      })),
      isBoardPlus: true,
    };
  },
);

// ─── Pending agenda inbox ───────────────────────────────────────────────

export interface PendingAgendaInboxItem {
  id: string;
  kind: "COMPLAINT_ESCALATION" | "BOARD_RESIGNATION";
  title: string;
  description: string | null;
  /** Tracking number for complaint sources, null for resignations. */
  complaintTrackingNumber: string | null;
  /** Resident's name for resignation sources. */
  resignationResidentName: string | null;
  /** Source detail-page href (relative). */
  sourceHref: string;
  createdAtISO: string;
}

export interface PendingAgendaInboxData {
  items: PendingAgendaInboxItem[];
  /** Next upcoming meeting in this building, used by quick-attach. */
  nextMeeting: { id: string; title: string; date: string } | null;
  isBoardPlus: boolean;
}

export const getPendingAgendaInbox = cache(
  async (): Promise<PendingAgendaInboxData> => {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    const isBoardPlus = allows(ctx, "vote.start");
    if (!isBoardPlus) {
      return { items: [], nextMeeting: null, isBoardPlus: false };
    }

    const [items, nextMeeting] = await Promise.all([
      prisma.pendingAgendaItem.findMany({
        where: {
          buildingId,
          attachedMeetingId: null,
          resolvedAt: null,
        },
        include: {
          complaint: {
            select: { id: true, trackingNumber: true },
          },
          resignation: {
            select: {
              id: true,
              userBuilding: {
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      }),
      prisma.meeting.findFirst({
        where: { buildingId, date: { gte: new Date() } },
        select: { id: true, title: true, date: true },
        orderBy: { date: "asc" },
      }),
    ]);

    return {
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        description: i.description,
        complaintTrackingNumber: i.complaint?.trackingNumber ?? null,
        resignationResidentName:
          i.resignation?.userBuilding.user.name ?? null,
        sourceHref: i.complaintId
          ? `/complaints/${i.complaintId}`
          : `/settings`,
        createdAtISO: i.createdAt.toISOString(),
      })),
      nextMeeting: nextMeeting
        ? {
            id: nextMeeting.id,
            title: nextMeeting.title,
            date: nextMeeting.date.toISOString(),
          }
        : null,
      isBoardPlus,
    };
  },
);

// ────────────────────────────────────────────────────────────────────────
// /api/reports/vote/[voteId] — vote-result PDF
// ────────────────────────────────────────────────────────────────────────

/**
 * Cross-tenant safe vote fetch for PDF rendering. Returns null when the
 * vote doesn't belong to `buildingId`.
 */
export async function findVoteForReport(voteId: string, buildingId: string) {
  return prisma.vote.findFirst({
    where: { id: voteId, buildingId },
    include: { building: { select: { id: true, name: true } } },
  });
}

/**
 * Sum of every unit's ownership share in a building — the denominator
 * for vote-weight totals on the result PDF.
 */
export async function listBuildingUnitShares(buildingId: string) {
  return prisma.unit.findMany({
    where: { buildingId },
    select: { ownershipShare: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// /api/reports/meeting/[meetingId] — meeting summary PDF
// ────────────────────────────────────────────────────────────────────────

export async function findMeetingForReport(meetingId: string, buildingId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, buildingId },
    include: {
      building: { select: { id: true, name: true } },
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
}

export async function findVoteSummaryForReport(voteId: string) {
  return prisma.vote.findUnique({
    where: { id: voteId },
    select: {
      id: true,
      title: true,
      status: true,
      majorityType: true,
      isSecret: true,
      deadline: true,
    },
  });
}

/**
 * Minimal cross-tenant safe vote-scope check for the reports/generate
 * route. Returns null when the vote doesn't belong to `buildingId`.
 */
export async function findVoteBuildingScope(voteId: string, buildingId: string) {
  return prisma.vote.findFirst({
    where: { id: voteId, buildingId },
    select: { id: true },
  });
}

/**
 * Minimal cross-tenant safe meeting-scope check.
 */
export async function findMeetingBuildingScope(
  meetingId: string,
  buildingId: string,
) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, buildingId },
    select: { id: true },
  });
}
