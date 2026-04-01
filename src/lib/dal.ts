import "server-only";

import { cache } from "react";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";

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
  const { buildingId, role } = await requireBuildingContext();
  await requireRole(role, "ADMIN");

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
  const { buildingId, role } = await requireBuildingContext();
  await requireRole(role, "ADMIN");

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

export interface ComplaintListItem {
  id: string;
  trackingNumber: string;
  category: string;
  description: string;
  photosCount: number;
  status: string;
  isPrivate: boolean;
  authorName: string;
  authorId: string;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsData {
  complaints: ComplaintListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getComplaints = cache(async (): Promise<ComplaintsData> => {
  const { userId, buildingId, role } = await requireBuildingContext();

  const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
  const limit = 20;

  const where: Record<string, unknown> = { buildingId };
  if (!isBoardPlus) {
    where.OR = [{ isPrivate: false }, { authorId: userId }];
  }

  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { notes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.complaint.count({ where }),
  ]);

  return {
    complaints: complaints.map((c) => {
      const photosArr = Array.isArray(c.photos) ? c.photos : [];
      return {
        id: c.id,
        trackingNumber: c.trackingNumber,
        category: c.category,
        description: c.description,
        photosCount: photosArr.length,
        status: c.status,
        isPrivate: c.isPrivate,
        authorName: c.author.name,
        authorId: c.author.id,
        notesCount: c._count.notes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    }),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Announcements ───────────────────────────────────────────────────────────

export interface AnnouncementListItem {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  author: { name: string };
  isRead: boolean;
  readCount: number;
  attachmentCount: number;
  createdAt: string;
}

export interface AnnouncementsData {
  announcements: AnnouncementListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getAnnouncements = cache(async (): Promise<AnnouncementsData> => {
  const { userId, buildingId, role } = await requireBuildingContext();

  const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
  const limit = 20;

  const where: Record<string, unknown> = { buildingId };
  if (!isBoardPlus) {
    where.targetAudience = { in: ["ALL", "SPECIFIC_UNITS"] };
  }

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: {
        author: { select: { name: true } },
        reads: { where: { userId }, select: { id: true }, take: 1 },
        _count: { select: { reads: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      targetAudience: a.targetAudience,
      author: { name: a.author.name },
      isRead: a.reads.length > 0,
      readCount: a._count.reads,
      attachmentCount: Array.isArray(a.attachments) ? a.attachments.length : 0,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Maintenance Tickets ─────────────────────────────────────────────────────

export interface TicketListItem {
  id: string;
  trackingNumber: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  reporter: { id: string; name: string };
  assignedContractor: { id: string; name: string } | null;
  createdAt: string;
}

export interface TicketsData {
  tickets: TicketListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getTickets = cache(async (): Promise<TicketsData> => {
  const { userId, buildingId, role } = await requireBuildingContext();
  await requireFeature(buildingId, "maintenance");

  const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
  const limit = 20;

  const where: Record<string, unknown> = { buildingId };
  if (!isBoardPlus) {
    where.reporterId = userId;
  }

  const [tickets, total] = await Promise.all([
    prisma.maintenanceTicket.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true } },
        assignedContractor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.maintenanceTicket.count({ where }),
  ]);

  return {
    tickets: tickets.map((t) => ({
      id: t.id,
      trackingNumber: t.trackingNumber,
      title: t.title,
      category: t.category,
      urgency: t.urgency,
      status: t.status,
      reporter: { id: t.reporter.id, name: t.reporter.name },
      assignedContractor: t.assignedContractor
        ? { id: t.assignedContractor.id, name: t.assignedContractor.name }
        : null,
      createdAt: t.createdAt.toISOString(),
    })),
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
  quorumRequired: number;
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
  const { buildingId } = await requireBuildingContext();
  await requireFeature(buildingId, "voting");

  const limit = 20;
  const where = { meeting: { buildingId } };

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
      quorumRequired: Number(v.quorumRequired),
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
  deadline: string;
  options: { id: string; label: string; votes: number; weight: number }[];
  totalWeight: number;
  ballotCount: number;
  quorumRequired: number;
  passed: boolean | null;
}

export interface MeetingAttendee {
  userId: string;
  userName: string;
  status: string;
}

export interface MeetingDetailData {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string | null;
  agenda: unknown;
  minutes: string | null;
  minutesUpdatedAt: string | null;
  minutesUpdatedBy: { name: string } | null;
  createdBy: { name: string };
  attendees: MeetingAttendee[];
  votes: MeetingVoteResult[];
  canEditMinutes: boolean;
}

export const getMeetingDetail = cache(async (id: string): Promise<MeetingDetailData> => {
  const { buildingId, role } = await requireBuildingContext();
  await requireFeature(buildingId, "voting");

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      minutesUpdatedBy: { select: { name: true } },
      rsvps: {
        include: { user: { select: { id: true, name: true } } },
      },
      votes: {
        include: {
          options: { orderBy: { sortOrder: "asc" as const } },
          ballots: { select: { optionId: true, weight: true } },
          _count: { select: { ballots: true } },
        },
      },
    },
  });

  if (!meeting || meeting.buildingId !== buildingId) {
    throw new Error("Meeting not found");
  }

  const canEditMinutes = hasMinimumRole(role, "BOARD_MEMBER");

  // Calculate vote results
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

    const quorumRequired = Number(v.quorumRequired);
    // For YES_NO votes, check if "Yes" option has > quorum weight
    let passed: boolean | null = null;
    if (v.status === "CLOSED" && totalWeight > 0) {
      const yesOption = v.options.find((o) => o.label.toLowerCase() === "yes" || o.label.toLowerCase() === "igen");
      if (yesOption) {
        const yesWeight = optionWeights.get(yesOption.id) ?? 0;
        passed = yesWeight / totalWeight >= quorumRequired;
      }
    }

    return {
      id: v.id,
      title: v.title,
      status: v.status,
      voteType: v.voteType,
      isSecret: v.isSecret,
      deadline: v.deadline.toISOString(),
      options: v.options.map((o) => ({
        id: o.id,
        label: o.label,
        votes: optionCounts.get(o.id) ?? 0,
        weight: optionWeights.get(o.id) ?? 0,
      })),
      totalWeight,
      ballotCount: v._count.ballots,
      quorumRequired,
      passed,
    };
  });

  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date.toISOString(),
    time: meeting.time,
    location: meeting.location,
    agenda: meeting.agenda,
    minutes: meeting.minutes,
    minutesUpdatedAt: meeting.minutesUpdatedAt?.toISOString() ?? null,
    minutesUpdatedBy: meeting.minutesUpdatedBy ? { name: meeting.minutesUpdatedBy.name } : null,
    createdBy: { name: meeting.createdBy.name },
    attendees: meeting.rsvps.map((r) => ({
      userId: r.user.id,
      userName: r.user.name,
      status: r.status,
    })),
    votes,
    canEditMinutes,
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
}

export interface DocumentsData {
  documents: DocumentListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const getDocuments = cache(async (): Promise<DocumentsData> => {
  const { buildingId, role } = await requireBuildingContext();

  const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
  const isAdmin = hasMinimumRole(role, "ADMIN");
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
    })),
    total,
    page: 1,
    totalPages: Math.ceil(total / limit),
  };
});

// ─── Forum ───────────────────────────────────────────────────────────────────

export interface ForumCategoryItem {
  id: string;
  name: string;
  topicCount: number;
}

export interface ForumTopicItem {
  id: string;
  title: string;
  categoryName: string;
  author: { name: string };
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  lastActivityAt: string;
}

export interface ForumData {
  categories: ForumCategoryItem[];
  topics: ForumTopicItem[];
  totalPages: number;
}

export const getForum = cache(async (): Promise<ForumData> => {
  const { buildingId } = await requireBuildingContext();
  await requireFeature(buildingId, "forum");

  const categories = await prisma.forumCategory.findMany({
    where: { buildingId },
    select: {
      id: true,
      name: true,
      _count: { select: { topics: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Fetch first page of topics (all categories)
  const [topics, totalCount] = await Promise.all([
    prisma.forumTopic.findMany({
      where: { category: { buildingId } },
      include: {
        category: { select: { name: true } },
        author: { select: { name: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }],
      take: 20,
    }),
    prisma.forumTopic.count({ where: { category: { buildingId } } }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      topicCount: c._count.topics,
    })),
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      categoryName: t.category.name,
      author: { name: t.author.name },
      isPinned: t.isPinned,
      isLocked: t.isLocked,
      replyCount: t._count.replies,
      lastActivityAt: t.lastActivityAt.toISOString(),
    })),
    totalPages: Math.ceil(totalCount / 20),
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
  const { buildingId, role } = await requireBuildingContext();
  await requireRole(role, "BOARD_MEMBER");

  const [totalResidents, totalUnits, openComplaintsCount, overduePaymentsCount, pendingMaintenanceCount] =
    await Promise.all([
      prisma.userBuilding.count({ where: { buildingId, isActive: true } }),
      prisma.unit.count({ where: { buildingId } }),
      prisma.complaint.count({
        where: { buildingId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS"] } },
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

export interface ResidentDashboardData {
  announcements: { id: string; title: string; createdAt: string }[];
  openTicketsCount: number;
  unreadNotificationsCount: number;
}

export const getResidentDashboard = cache(async (): Promise<ResidentDashboardData> => {
  const { userId, buildingId } = await requireBuildingContext();

  const [announcements, openTicketsCount, unreadNotificationsCount] = await Promise.all([
    prisma.announcement.findMany({
      where: { buildingId, targetAudience: { in: ["ALL", "SPECIFIC_UNITS"] } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.maintenanceTicket.count({
      where: {
        reporterId: userId,
        buildingId,
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
      },
    }).catch(() => 0),
    prisma.notification.count({
      where: { userId, isRead: false },
    }).catch(() => 0),
  ]);

  return {
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      createdAt: a.createdAt.toISOString(),
    })),
    openTicketsCount,
    unreadNotificationsCount,
  };
});

export interface DashboardContext {
  role: string;
  userName: string;
}

export const getDashboardContext = cache(async (): Promise<DashboardContext> => {
  const { role } = await requireBuildingContext();
  // Get user name from session
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  return {
    role,
    userName: user?.name ?? "",
  };
});
