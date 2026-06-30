import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireBuildingContext } from "@/lib/auth";
import {
  requirePageContext,
  requirePageFeature,
  requirePageCapability,
} from "@/lib/page-guard";
import { allows, requireCapability } from "@/lib/authz";
import { requireFeature } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";
import { calculateMeetingQuorum } from "@/lib/voting/quorum";

// ─── Units ───────────────────────────────────────────────────────────────────

export interface UnitListItem {
  id: string;
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
  residentCount: number;
  primaryContact: string | null;
}

export interface UnitsData {
  units: UnitListItem[];
  totalOwnershipShare: number;
  buildingName: string;
}

export const getUnits = cache(async (): Promise<UnitsData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "view.adminContext");

  const [units, building] = await Promise.all([
    prisma.unit.findMany({
      where: { buildingId },
      select: {
        id: true,
        number: true,
        floor: true,
        size: true,
        ownershipShare: true,
        _count: { select: { unitUsers: true } },
        unitUsers: {
          where: { isPrimaryContact: true },
          select: { user: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    }),
    prisma.building.findUnique({
      where: { id: buildingId },
      select: { name: true },
    }),
  ]);

  const totalOwnershipShare = units.reduce(
    (sum, u) => sum + Number(u.ownershipShare),
    0
  );

  return {
    units: units.map((u) => ({
      id: u.id,
      number: u.number,
      floor: u.floor,
      size: Number(u.size),
      ownershipShare: Number(u.ownershipShare),
      residentCount: u._count.unitUsers,
      primaryContact: u.unitUsers[0]?.user?.name ?? null,
    })),
    totalOwnershipShare,
    buildingName: building?.name ?? "",
  };
});

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: string;
  unitId: string | null;
  unit: { number: string } | null;
  isPrimaryContact: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface UsersData {
  users: UserListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getUsers = cache(async (): Promise<UsersData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "users.manage");

  const limit = 20;
  const where = { buildingId };

  const [userBuildings, total] = await Promise.all([
    prisma.userBuilding.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { user: { name: "asc" } },
      take: limit,
    }),
    prisma.userBuilding.count({ where }),
  ]);

  const userIds = userBuildings.map((ub) => ub.userId);
  const unitUsers = await prisma.unitUser.findMany({
    where: { userId: { in: userIds }, unit: { buildingId } },
    include: { unit: { select: { id: true, number: true } } },
  });
  const unitMap = new Map<string, { unitId: string; unitNumber: string; isPrimaryContact: boolean }>();
  for (const uu of unitUsers) {
    if (!unitMap.has(uu.userId)) {
      unitMap.set(uu.userId, {
        unitId: uu.unit.id,
        unitNumber: uu.unit.number,
        isPrimaryContact: uu.isPrimaryContact,
      });
    }
  }

  return {
    users: userBuildings.map((ub) => ({
      id: ub.user.id,
      email: ub.user.email,
      name: ub.user.name,
      role: ub.role,
      unitId: unitMap.get(ub.userId)?.unitId ?? null,
      unit: unitMap.get(ub.userId) ? { number: unitMap.get(ub.userId)!.unitNumber } : null,
      isPrimaryContact: unitMap.get(ub.userId)?.isPrimaryContact ?? false,
      isActive: ub.user.isActive,
      createdAt: ub.user.createdAt.toISOString(),
    })),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Complaints ──────────────────────────────────────────────────────────────

export interface ComplaintCategoryRef {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

export interface ComplaintListItem {
  id: string;
  trackingNumber: string;
  title: string | null;
  category: ComplaintCategoryRef;
  description: string;
  photosCount: number;
  status: string;
  isPrivate: boolean;
  authorName: string;
  authorId: string;
  respondentUnitLabel: string | null;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsData {
  complaints: ComplaintListItem[];
  /** Active categories for this building (for filters / counts). */
  categories: ComplaintCategoryRef[];
  total: number;
  page: number;
  totalPages: number;
}

export const getComplaints = cache(async (): Promise<ComplaintsData> => {
  const ctx = await requireBuildingContext();
  const { userId, buildingId } = ctx;

  const isBoardPlus = allows(ctx, "view.boardContext");
  const limit = 20;

  const where: Prisma.ComplaintWhereInput = { buildingId };
  if (!isBoardPlus) {
    where.OR = [{ isPrivate: false }, { authorId: userId }];
  }

  const [complaints, total, categories] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, slug: true, name: true, icon: true } },
        respondentUnit: {
          select: { id: true, number: true, stairwell: true },
        },
        _count: { select: { notes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.complaint.count({ where }),
    prisma.complaintCategory.findMany({
      where: { buildingId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, icon: true },
    }),
  ]);

  return {
    complaints: complaints.map((c) => {
      const photosArr = Array.isArray(c.photos) ? c.photos : [];
      const respondentUnitLabel = c.respondentUnit
        ? `${c.respondentUnit.stairwell ? c.respondentUnit.stairwell + "/" : ""}${c.respondentUnit.number}`
        : null;
      return {
        id: c.id,
        trackingNumber: c.trackingNumber,
        title: c.title,
        category: {
          id: c.category.id,
          slug: c.category.slug,
          name: c.category.name,
          icon: c.category.icon,
        },
        description: c.description,
        photosCount: photosArr.length,
        status: c.status,
        isPrivate: c.isPrivate,
        authorName: c.author.name,
        authorId: c.author.id,
        respondentUnitLabel,
        notesCount: c._count.notes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    }),
    categories,
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Voting ──────────────────────────────────────────────────────────────────

export interface VoteListItem {
  id: string;
  title: string;
  description: string | null;
  voteType: string;
  status: string;
  isSecret: boolean;
  majorityType: string;
  quorumRequired: number; // @deprecated
  deadline: string;
  createdBy: { id: string; name: string };
  options: { id: string; label: string; sortOrder: number }[];
  ballotCount: number;
  createdAt: string;
}

export interface VotesData {
  votes: VoteListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getVotes = cache(async (): Promise<VotesData> => {
  const { buildingId } = await requirePageContext();
  await requirePageFeature(buildingId, "voting");

  const limit = 20;
  const where = { buildingId };

  const [votes, total] = await Promise.all([
    prisma.vote.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" as const } },
        _count: { select: { ballots: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.vote.count({ where }),
  ]);

  return {
    votes: votes.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      voteType: v.voteType,
      status: v.status,
      isSecret: v.isSecret,
      majorityType: v.majorityType,
      quorumRequired: Number(v.quorumRequired), // @deprecated
      deadline: v.deadline.toISOString(),
      createdBy: v.createdBy,
      options: v.options.map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sortOrder,
      })),
      ballotCount: v._count.ballots,
      createdAt: v.createdAt.toISOString(),
    })),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Meeting Detail ──────────────────────────────────────────────────────────

export interface MeetingVoteResult {
  id: string;
  title: string;
  status: string;
  voteType: string;
  isSecret: boolean;
  majorityType: string;
  deadline: string;
  options: { id: string; label: string; votes: number; weight: number }[];
  totalWeight: number;
  ballotCount: number;
  passed: boolean | null;
  /** True when this vote decides a marketplace bid award. */
  isAwardVote: boolean;
  /** Auto-award outcome, computed for a CLOSED award vote (else null). */
  award:
    | {
        outcome: "AWARDED" | "NONE" | "NO_QUORUM";
        winnerLabel: string | null;
        winnerAmount: number | null;
      }
    | null;
}

export interface MeetingAttendee {
  userId: string;
  userName: string;
  status: string;
}

export interface MeetingQuorumData {
  isQuorate: boolean;
  presentWeight: number;
  totalWeight: number;
  presentPercentage: number;
  presentUnitCount: number;
  totalUnitCount: number;
}

export interface MeetingMinutesSignatureData {
  role: "CHAIR" | "AUTHENTICATOR_1" | "AUTHENTICATOR_2";
  signerId: string;
  signerName: string;
  signedAt: string;
}

export interface MeetingDetailData {
  id: string;
  buildingId: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string | null;
  agenda: unknown;
  isRepeated: boolean;
  /** Live assembly (Közgyűlés mód) session state. */
  liveStatus: "SCHEDULED" | "LIVE" | "CLOSED";
  format: "IN_PERSON" | "HYBRID" | "ONLINE" | null;
  voteMode: "DEVICE" | "HANDS" | null;
  currentAgendaIndex: number;
  currentVoteId: string | null;
  startedAt: string | null;
  minutes: string | null;
  minutesUpdatedAt: string | null;
  minutesUpdatedBy: { name: string } | null;
  createdBy: { name: string };
  attendees: MeetingAttendee[];
  quorum: MeetingQuorumData;
  votes: MeetingVoteResult[];
  canEditMinutes: boolean;
  /** All filled signature slots so far. Present even when minutes are empty. */
  signatures: MeetingMinutesSignatureData[];
  /** True when the current user is a board member — gates the sign UI. */
  canSignMinutes: boolean;
  /** Pre-resolved current user id for "have I already signed?" check. */
  currentUserId: string;
  /** Live Q&A items (questions + raise-hand), oldest first. */
  questions: MeetingQuestionItem[];
}

export interface MeetingQuestionItem {
  id: string;
  type: "QUESTION" | "HAND";
  body: string | null;
  userName: string;
  agendaIndex: number;
  status: "PENDING" | "ADDRESSED";
  createdAt: string;
}

export const getMeetingDetail = cache(async (id: string): Promise<MeetingDetailData> => {
  const ctx = await requirePageContext();
  const { userId, buildingId } = ctx;
  await requirePageFeature(buildingId, "voting");

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      minutesUpdatedBy: { select: { name: true } },
      rsvps: {
        include: { user: { select: { id: true, name: true } } },
      },
      questions: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      votes: {
        include: {
          options: {
            orderBy: { sortOrder: "asc" as const },
            include: { bid: { select: { amount: true } } },
          },
          ballots: { select: { optionId: true, weight: true } },
          _count: { select: { ballots: true } },
        },
      },
      minutesSignatures: {
        include: { signer: { select: { id: true, name: true } } },
        orderBy: { signedAt: "asc" },
      },
    },
  });

  // Missing or cross-tenant → 404 (don't leak existence across buildings).
  if (!meeting || meeting.buildingId !== buildingId) {
    notFound();
  }

  const canEditMinutes = allows(ctx, "vote.editMinutes");

  // Calculate vote results with majority-type-aware logic
  const totalBuildingShares = await prisma.unit.findMany({
    where: { buildingId },
    select: { ownershipShare: true },
  }).then((units) => units.reduce((sum, u) => sum + Number(u.ownershipShare), 0));

  const votes: MeetingVoteResult[] = meeting.votes.map((v) => {
    const optionWeights = new Map<string, number>();
    const optionCounts = new Map<string, number>();
    let totalWeight = 0;

    for (const ballot of v.ballots) {
      const w = Number(ballot.weight);
      totalWeight += w;
      optionWeights.set(ballot.optionId, (optionWeights.get(ballot.optionId) ?? 0) + w);
      optionCounts.set(ballot.optionId, (optionCounts.get(ballot.optionId) ?? 0) + 1);
    }

    // Identify abstain option
    const abstainLabels = ["abstain", "tartózkodom", "tartózkodás", "tartózkodik"];
    const abstainOption = v.options.find((o) => abstainLabels.includes(o.label.toLowerCase()));
    const abstainWeight = abstainOption ? (optionWeights.get(abstainOption.id) ?? 0) : 0;

    let passed: boolean | null = null;
    if (v.status === "CLOSED" && totalWeight > 0) {
      const yesOption = v.options[0]; // First option is "Yes"/"Igen" for YES_NO
      if (yesOption) {
        const yesWeight = optionWeights.get(yesOption.id) ?? 0;
        const effectiveWeight = totalWeight - abstainWeight;

        switch (v.majorityType) {
          case "SIMPLE_MAJORITY":
            passed = effectiveWeight > 0 && yesWeight / effectiveWeight > 0.5;
            break;
          case "TWO_THIRDS":
            passed = totalBuildingShares > 0 && yesWeight / totalBuildingShares >= 2 / 3;
            break;
          case "FOUR_FIFTHS":
            passed = totalBuildingShares > 0 && yesWeight / totalBuildingShares >= 4 / 5;
            break;
          case "UNANIMOUS":
            passed = totalBuildingShares > 0 && Math.abs(yesWeight - totalBuildingShares) < 0.0001;
            break;
          case "PLURALITY": {
            const sorted = [...v.options].sort(
              (a, b) => (optionWeights.get(b.id) ?? 0) - (optionWeights.get(a.id) ?? 0)
            );
            passed = sorted.length > 0 && (optionWeights.get(sorted[0].id) ?? 0) > 0;
            break;
          }
          default:
            passed = effectiveWeight > 0 && yesWeight / effectiveWeight > 0.5;
        }
      }
    }

    // Auto-award outcome for a closed contractor-award vote (mirrors
    // resolveAwardVote: 50% participation quorum, plurality winner with a bid).
    const isAwardVote = v.linkedPublicationId != null;
    let award: MeetingVoteResult["award"] = null;
    if (isAwardVote && v.status === "CLOSED") {
      const AWARD_QUORUM = 0.5;
      if (totalBuildingShares <= 0 || totalWeight / totalBuildingShares < AWARD_QUORUM) {
        award = { outcome: "NO_QUORUM", winnerLabel: null, winnerAmount: null };
      } else {
        const top = [...v.options].sort(
          (a, b) => (optionWeights.get(b.id) ?? 0) - (optionWeights.get(a.id) ?? 0),
        )[0];
        const topWeight = top ? (optionWeights.get(top.id) ?? 0) : 0;
        if (!top || topWeight <= 0 || !top.bid) {
          award = { outcome: "NONE", winnerLabel: null, winnerAmount: null };
        } else {
          award = {
            outcome: "AWARDED",
            winnerLabel: top.label,
            winnerAmount: Number(top.bid.amount),
          };
        }
      }
    }

    return {
      id: v.id,
      title: v.title,
      status: v.status,
      voteType: v.voteType,
      isSecret: v.isSecret,
      majorityType: v.majorityType,
      deadline: v.deadline.toISOString(),
      options: v.options.map((o) => ({
        id: o.id,
        label: o.label,
        votes: optionCounts.get(o.id) ?? 0,
        weight: optionWeights.get(o.id) ?? 0,
      })),
      totalWeight,
      ballotCount: v._count.ballots,
      passed,
      isAwardVote,
      award,
    };
  });

  const quorum = await calculateMeetingQuorum(meeting.id);

  return {
    id: meeting.id,
    buildingId,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date.toISOString(),
    time: meeting.time,
    location: meeting.location,
    agenda: meeting.agenda,
    isRepeated: meeting.isRepeated,
    liveStatus: meeting.liveStatus,
    format: meeting.format,
    voteMode: meeting.voteMode,
    currentAgendaIndex: meeting.currentAgendaIndex,
    currentVoteId: meeting.currentVoteId,
    startedAt: meeting.startedAt?.toISOString() ?? null,
    minutes: meeting.minutes,
    minutesUpdatedAt: meeting.minutesUpdatedAt?.toISOString() ?? null,
    minutesUpdatedBy: meeting.minutesUpdatedBy ? { name: meeting.minutesUpdatedBy.name } : null,
    createdBy: { name: meeting.createdBy.name },
    attendees: meeting.rsvps.map((r) => ({
      userId: r.user.id,
      userName: r.user.name,
      status: r.status,
    })),
    quorum,
    votes,
    canEditMinutes,
    signatures: meeting.minutesSignatures.map((s) => ({
      role: s.role,
      signerId: s.signer.id,
      signerName: s.signer.name,
      signedAt: s.signedAt.toISOString(),
    })),
    canSignMinutes: canEditMinutes,
    currentUserId: userId,
    questions: meeting.questions.map((q) => ({
      id: q.id,
      type: q.type,
      body: q.body,
      userName: q.user.name,
      agendaIndex: q.agendaIndex,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
    })),
  };
});

// ─── Documents ───────────────────────────────────────────────────────────────

export interface DocumentListItem {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  category: { id: string; name: string };
  visibility: string;
  uploadedBy: { id: string; name: string };
  latestVersion: {
    id: string;
    versionNumber: number;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsData {
  documents: DocumentListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getDocuments = cache(async (): Promise<DocumentsData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;

  const isBoardPlus = allows(ctx, "view.boardContext");
  const isAdmin = allows(ctx, "view.adminContext");
  const limit = 20;

  const where: Record<string, unknown> = {
    category: { buildingId },
    isArchived: false,
  };
  if (!isAdmin) {
    if (isBoardPlus) {
      where.visibility = { in: ["PUBLIC", "BOARD_ONLY"] };
    } else {
      where.visibility = "PUBLIC";
    }
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      categoryId: d.categoryId,
      category: { id: d.category.id, name: d.category.name },
      visibility: d.visibility,
      uploadedBy: { id: d.uploadedBy.id, name: d.uploadedBy.name },
      latestVersion: d.versions[0]
        ? {
            id: d.versions[0].id,
            versionNumber: d.versions[0].versionNumber,
            fileName: d.versions[0].fileName,
            fileSize: d.versions[0].fileSize,
            mimeType: d.versions[0].mimeType,
            uploadedAt: d.versions[0].uploadedAt.toISOString(),
          }
        : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface AdminDashboardData {
  totalUnits: number;
  totalResidents: number;
  overduePaymentsCount: number;
  openComplaintsCount: number;
  pendingMaintenanceCount: number;
}

export const getAdminDashboard = cache(async (): Promise<AdminDashboardData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "view.boardContext");

  const [totalResidents, totalUnits, openComplaintsCount, overduePaymentsCount, pendingMaintenanceCount] =
    await Promise.all([
      prisma.userBuilding.count({ where: { buildingId, isActive: true } }),
      prisma.unit.count({ where: { buildingId } }),
      prisma.complaint.count({
        where: {
          buildingId,
          status: {
            in: ["REPORTED", "ACKNOWLEDGED", "WARNING_SENT", "MEDIATION"],
          },
        },
      }),
      prisma.monthlyCharge.count({
        where: { unit: { buildingId }, status: "UNPAID" },
      }),
      prisma.maintenanceTicket.count({
        where: { buildingId, status: { in: ["SUBMITTED", "ACKNOWLEDGED"] } },
      }).catch(() => 0),
    ]);

  return {
    totalUnits,
    totalResidents,
    overduePaymentsCount,
    openComplaintsCount,
    pendingMaintenanceCount,
  };
});

export interface DashboardContext {
  role: string;
  userName: string;
  // ActorContext flags for the active building, so RSC pages can use can().
  isChair: boolean;
  ownsAnyUnit: boolean;
  isAuditor: boolean;
  isProfessional: boolean;
}

export const getDashboardContext = cache(async (): Promise<DashboardContext> => {
  const { role, isChair, ownsAnyUnit, isAuditor, isProfessional } =
    await requireBuildingContext();
  // Get user name from session
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  return {
    role,
    userName: user?.name ?? "",
    isChair,
    ownsAnyUnit,
    isAuditor,
    isProfessional,
  };
});

// ─── Complaint Detail ───────────────────────────────────────────────────────

export interface ComplaintNoteData {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string };
  createdAt: string;
}

export interface StatusChange {
  fromStatus: string | null;
  toStatus: string;
  date: string;
  actor: { id: string; name: string };
  note: string | null;
}

export interface ComplaintDetailPhoto {
  name: string;
  url: string;
  size?: number;
}

export interface ComplaintDetailData {
  id: string;
  trackingNumber: string;
  title: string | null;
  category: ComplaintCategoryRef;
  description: string;
  photos: ComplaintDetailPhoto[];
  status: string;
  isPrivate: boolean;
  author: { id: string; name: string };
  authorId: string;
  respondentUnit: {
    id: string;
    label: string;
  } | null;
  escalatedMeeting: {
    id: string;
    title: string;
    date: string;
  } | null;
  /**
   * Cross-cutting agenda-queue state for this complaint, when escalated.
   * Null if the complaint is not currently on the queue.
   *
   * - `state: "queued"`     — escalated, no meeting attached yet
   * - `state: "attached"`   — attached to a meeting, awaiting it
   * - `state: "resolved"`   — board explicitly closed the item
   */
  pendingAgenda: {
    id: string;
    state: "queued" | "attached" | "resolved";
    attachedMeeting: { id: string; title: string; date: string } | null;
    resolvedAt: string | null;
    resolutionNote: string | null;
    resolvedBy: { id: string; name: string } | null;
  } | null;
  notes: ComplaintNoteData[];
  statusChanges: StatusChange[];
  isBoardPlus: boolean;
  currentUserId: string;
  createdAt: string;
  updatedAt: string;
}

export const getComplaintDetail = cache(
  async (id: string): Promise<ComplaintDetailData> => {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    const isBoardPlus = allows(ctx, "view.boardContext");

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        category: {
          select: { id: true, slug: true, name: true, icon: true },
        },
        respondentUnit: {
          select: { id: true, number: true, stairwell: true },
        },
        pendingAgenda: {
          include: {
            attachedMeeting: {
              select: { id: true, title: true, date: true },
            },
            resolvedBy: { select: { id: true, name: true } },
          },
        },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        statusEvents: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!complaint || complaint.buildingId !== buildingId) {
      notFound();
    }

    // Private complaint hidden from non-board non-authors — mask as 404.
    if (!isBoardPlus && complaint.isPrivate && complaint.authorId !== userId) {
      notFound();
    }

    const visibleNotes = isBoardPlus
      ? complaint.notes
      : complaint.notes.filter((n) => !n.isInternal);

    const photosArr = Array.isArray(complaint.photos)
      ? (complaint.photos as unknown as ComplaintDetailPhoto[])
      : [];

    return {
      id: complaint.id,
      trackingNumber: complaint.trackingNumber,
      title: complaint.title,
      category: {
        id: complaint.category.id,
        slug: complaint.category.slug,
        name: complaint.category.name,
        icon: complaint.category.icon,
      },
      description: complaint.description,
      photos: photosArr,
      status: complaint.status,
      isPrivate: complaint.isPrivate,
      author: { id: complaint.author.id, name: complaint.author.name },
      authorId: complaint.authorId,
      respondentUnit: complaint.respondentUnit
        ? {
            id: complaint.respondentUnit.id,
            label: `${complaint.respondentUnit.stairwell ? complaint.respondentUnit.stairwell + "/" : ""}${complaint.respondentUnit.number}`,
          }
        : null,
      escalatedMeeting: complaint.pendingAgenda?.attachedMeeting
        ? {
            id: complaint.pendingAgenda.attachedMeeting.id,
            title: complaint.pendingAgenda.attachedMeeting.title,
            date: complaint.pendingAgenda.attachedMeeting.date.toISOString(),
          }
        : null,
      pendingAgenda: complaint.pendingAgenda
        ? {
            id: complaint.pendingAgenda.id,
            state: complaint.pendingAgenda.resolvedAt
              ? "resolved"
              : complaint.pendingAgenda.attachedMeetingId
                ? "attached"
                : "queued",
            attachedMeeting: complaint.pendingAgenda.attachedMeeting
              ? {
                  id: complaint.pendingAgenda.attachedMeeting.id,
                  title: complaint.pendingAgenda.attachedMeeting.title,
                  date: complaint.pendingAgenda.attachedMeeting.date.toISOString(),
                }
              : null,
            resolvedAt:
              complaint.pendingAgenda.resolvedAt?.toISOString() ?? null,
            resolutionNote: complaint.pendingAgenda.resolutionNote,
            resolvedBy: complaint.pendingAgenda.resolvedBy
              ? {
                  id: complaint.pendingAgenda.resolvedBy.id,
                  name: complaint.pendingAgenda.resolvedBy.name,
                }
              : null,
          }
        : null,
      notes: visibleNotes.map((n) => ({
        id: n.id,
        body: n.body,
        isInternal: n.isInternal,
        author: { id: n.author.id, name: n.author.name },
        createdAt: n.createdAt.toISOString(),
      })),
      statusChanges: complaint.statusEvents.map((e) => ({
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        date: e.createdAt.toISOString(),
        actor: { id: e.actor.id, name: e.actor.name },
        note: e.note,
      })),
      isBoardPlus,
      currentUserId: userId,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: complaint.updatedAt.toISOString(),
    };
  },
);

// ─── Finance Overview (Resident) ────────────────────────────────────────────

export interface ChargeSummaryData {
  currentBalance: number;
  nextDue: { amount: number; month: string } | null;
  lastPayment: { amount: number; paidAt: string } | null;
}

export interface ChargeItem {
  id: string;
  month: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  status: string;
  invoiceId: string | null;
}

export interface FinanceOverviewData {
  summary: ChargeSummaryData;
  charges: ChargeItem[];
  allCharges: ChargeItem[];
  total: number;
  page: number;
  totalPages: number;
  isBoardPlus: boolean;
}

export const getFinanceOverview = cache(async (): Promise<FinanceOverviewData> => {
  const ctx = await requirePageContext();
  const { userId, buildingId } = ctx;
  await requirePageFeature(buildingId, "finance");

  const isBoardPlus = allows(ctx, "view.building.finance");

  // Find unit for current user
  const unitUser = await prisma.unitUser.findFirst({
    where: { userId, unit: { buildingId } },
    select: { unitId: true },
  });

  const unitId = unitUser?.unitId;
  const chargeWhere = unitId ? { unitId } : { unitId: "__none__" };

  const [charges, total, allCharges] = await Promise.all([
    prisma.monthlyCharge.findMany({
      where: chargeWhere,
      orderBy: { month: "desc" },
      take: 10,
    }),
    prisma.monthlyCharge.count({ where: chargeWhere }),
    prisma.monthlyCharge.findMany({
      where: chargeWhere,
      orderBy: { month: "desc" },
      take: 50,
    }),
  ]);

  // Calculate summary
  const unpaid = allCharges.filter((c) => c.status === "UNPAID");
  const paid = allCharges.filter((c) => c.status === "PAID");
  const currentBalance = unpaid.reduce((sum, c) => sum + Number(c.amount), 0);
  const nextUnpaid = unpaid.sort((a, b) => a.month.localeCompare(b.month))[0];
  const lastPaid = paid.sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))[0];

  const mapCharge = (c: typeof charges[number]): ChargeItem => ({
    id: c.id,
    month: c.month,
    amount: Number(c.amount),
    dueDate: null,
    paidAt: c.paidAt?.toISOString() ?? null,
    status: c.status,
    invoiceId: null,
  });

  return {
    summary: {
      currentBalance,
      nextDue: nextUnpaid ? { amount: Number(nextUnpaid.amount), month: nextUnpaid.month } : null,
      lastPayment: lastPaid ? { amount: Number(lastPaid.amount), paidAt: lastPaid.paidAt!.toISOString() } : null,
    },
    charges: charges.map(mapCharge),
    allCharges: allCharges.map(mapCharge),
    total,
    page: 1,
    totalPages: Math.ceil(total / 10),
    isBoardPlus,
  };
});

// ─── Building Finance (Board+) ──────────────────────────────────────────────

export interface FinanceSummaryData {
  currentFundBalance: number;
  reserveFundBalance: number;
  totalIncome: number;
  totalExpenses: number;
}

export interface BudgetItemData {
  accountId: string;
  name: string;
  plannedAmount: number;
  actualAmount: number;
}

export interface LedgerEntryData {
  id: string;
  date: string;
  description: string;
  amount: number;
  debitAccount: { name: string };
  creditAccount: { name: string };
  createdBy: { name: string } | null;
}

export interface AccountData {
  id: string;
  name: string;
  type: string;
}

export interface BuildingFinanceData {
  summary: FinanceSummaryData;
  budgetItems: BudgetItemData[];
  ledger: {
    entries: LedgerEntryData[];
    total: number;
    page: number;
    totalPages: number;
  };
  accounts: AccountData[];
}

export const getBuildingFinance = cache(async (): Promise<BuildingFinanceData> => {
  const ctx = await requirePageContext();
  const { buildingId, role } = ctx;
  requirePageCapability(ctx, "view.building.finance");
  await requirePageFeature(buildingId, "finance");

  const currentYear = new Date().getFullYear();
  const fromDate = new Date(`${currentYear}-01-01`);
  const toDate = new Date(`${currentYear}-12-31T23:59:59`);

  const [accounts, budgets, ledgerEntries, ledgerTotal] = await Promise.all([
    prisma.account.findMany({
      where: { buildingId },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { year: currentYear, account: { buildingId } },
      include: { account: { select: { id: true, name: true } } },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        OR: [
          { debitAccount: { buildingId } },
          { creditAccount: { buildingId } },
        ],
      },
      include: {
        debitAccount: { select: { name: true } },
        creditAccount: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.ledgerEntry.count({
      where: {
        date: { gte: fromDate, lte: toDate },
        OR: [
          { debitAccount: { buildingId } },
          { creditAccount: { buildingId } },
        ],
      },
    }),
  ]);

  // Calculate summary from all ledger entries for the year
  const allEntries = await prisma.ledgerEntry.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      OR: [
        { debitAccount: { buildingId } },
        { creditAccount: { buildingId } },
      ],
    },
    include: {
      debitAccount: { select: { type: true } },
      creditAccount: { select: { type: true } },
    },
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const entry of allEntries) {
    const amount = Number(entry.amount);
    if (entry.creditAccount.type === "INCOME") totalIncome += amount;
    if (entry.debitAccount.type === "EXPENSE") totalExpenses += amount;
  }

  // Budget items with actual amounts
  const budgetItems: BudgetItemData[] = budgets.map((b) => {
    const actual = allEntries
      .filter((e) => e.debitAccountId === b.accountId || e.creditAccountId === b.accountId)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      accountId: b.account.id,
      name: b.account.name,
      plannedAmount: Number(b.plannedAmount),
      actualAmount: actual,
    };
  });

  return {
    summary: {
      currentFundBalance: totalIncome - totalExpenses,
      reserveFundBalance: 0,
      totalIncome,
      totalExpenses,
    },
    budgetItems,
    ledger: {
      entries: ledgerEntries.map((e) => ({
        id: e.id,
        date: e.date.toISOString(),
        description: e.description,
        amount: Number(e.amount),
        debitAccount: { name: e.debitAccount.name },
        creditAccount: { name: e.creditAccount.name },
        createdBy: e.createdBy ? { name: e.createdBy.name } : null,
      })),
      total: ledgerTotal,
      page: 1,
      totalPages: Math.ceil(ledgerTotal / 10),
    },
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
    })),
  };
});

// ─── Billing ────────────────────────────────────────────────────────────────

export interface BillingSubscriptionData {
  planSlug: string;
  planName: string;
  features: string[];
  maxBuildings: number;
  maxUnitsPerBuilding: number;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isLegacy: boolean;
  hasStripe: boolean;
}

export interface FrozenBuildingData {
  id: string;
  name: string;
  address: string;
}

export interface BillingUsageData {
  buildings: { current: number; max: number };
  units: { current: number; max: number };
  frozenBuildings: FrozenBuildingData[];
}

export interface BillingData {
  subscription: BillingSubscriptionData | null;
  usage: BillingUsageData | null;
}

export const getBillingData = cache(async (): Promise<BillingData> => {
  const { buildingId } = await requireBuildingContext();

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!building?.subscription) {
    return {
      subscription: {
        planSlug: "legacy",
        planName: "Legacy",
        features: [],
        maxBuildings: -1,
        maxUnitsPerBuilding: -1,
        subscriptionStatus: "ACTIVE",
        trialEndsAt: null,
        isLegacy: true,
        hasStripe: false,
      },
      usage: null,
    };
  }

  const sub = building.subscription;
  const plan = sub.plan;
  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];

  // Calculate usage
  const [buildingCount, unitCount, frozenBuildings] = await Promise.all([
    prisma.building.count({ where: { subscriptionId: sub.id } }),
    prisma.unit.count({
      where: { building: { subscriptionId: sub.id } },
    }),
    prisma.building.findMany({
      where: { subscriptionId: sub.id, isFrozen: true },
      select: { id: true, name: true, address: true },
    }),
  ]);

  return {
    subscription: {
      planSlug: plan.slug,
      planName: plan.name,
      features,
      maxBuildings: plan.maxBuildings,
      maxUnitsPerBuilding: plan.maxUnitsPerBuilding,
      subscriptionStatus: sub.subscriptionStatus,
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      isLegacy: false,
      hasStripe: !!sub.stripeSubscriptionId,
    },
    usage: {
      buildings: { current: buildingCount, max: plan.maxBuildings },
      units: { current: unitCount, max: plan.maxUnitsPerBuilding },
      frozenBuildings,
    },
  };
});

// ─── Invitations ────────────────────────────────────────────────────────────

export interface InvitationItemData {
  id: string;
  email: string;
  type: string;
  role: string | null;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: { name: string } | null;
  unit: { number: string } | null;
}

export interface InvitationsData {
  invitations: InvitationItemData[];
  isAdmin: boolean;
}

export const getInvitations = cache(async (): Promise<InvitationsData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  requireCapability(ctx, "users.manage");

  const invitations = await prisma.invitation.findMany({
    where: { buildingId },
    include: {
      invitedBy: { select: { name: true } },
      unit: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      type: inv.type,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      acceptedAt: inv.acceptedAt?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
      invitedBy: inv.invitedBy ? { name: inv.invitedBy.name } : null,
      unit: inv.unit ? { number: inv.unit.number } : null,
    })),
    isAdmin: allows(ctx, "view.adminContext"),
  };
});

// ─── Buildings (Admin) ──────────────────────────────────────────────────────

export interface BuildingItemData {
  id: string;
  name: string;
  address: string;
  city: string;
  zipCode: string;
  unitCount: number;
  userCount: number;
}

export interface BuildingsData {
  buildings: BuildingItemData[];
}

export const getBuildings = cache(async (): Promise<BuildingsData> => {
  const { buildingId } = await requireBuildingContext();

  // Get subscription to find all buildings
  const currentBuilding = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { subscriptionId: true },
  });

  const buildings = await prisma.building.findMany({
    where: currentBuilding?.subscriptionId
      ? { subscriptionId: currentBuilding.subscriptionId }
      : { id: buildingId },
    include: {
      _count: { select: { units: true, userBuildings: true } },
    },
    orderBy: { name: "asc" },
  });

  return {
    buildings: buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      zipCode: b.zipCode,
      unitCount: b._count.units,
      userCount: b._count.userBuildings,
    })),
  };
});

// ─── Notifications ──────────────────────────────────────────────────────────

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface NotificationsData {
  notifications: NotificationItemData[];
  total: number;
  page: number;
  totalPages: number;
}

export const getNotifications = cache(async (): Promise<NotificationsData> => {
  const { userId } = await requireBuildingContext();

  const limit = 20;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      entityType: n.entityType,
      entityId: n.entityId,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

