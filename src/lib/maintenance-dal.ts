import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";

// ─── Types ────────────────────────────────────────────────────────────────

export type TicketStatusKey =
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED";

export type UrgencyKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CategoryKey =
  | "PLUMBING"
  | "ELECTRICAL"
  | "STRUCTURAL"
  | "COMMON_AREA"
  | "ELEVATOR"
  | "HEATING"
  | "OTHER";

/** Kanban column key. Maps multiple statuses to one visual lane. */
export type KanbanColumn = "submitted" | "acknowledged" | "in_progress" | "closed";

export interface MaintenanceTicketCard {
  id: string;
  trackingNumber: string;
  title: string;
  category: CategoryKey;
  urgency: UrgencyKey;
  status: TicketStatusKey;
  location: string | null;
  reporterName: string;
  assigneeName: string | null;
  /** "BT" (contractor) or initials for reporter, used by avatar tile. */
  assigneeInitials: string | null;
  /** When the ticket was created. */
  createdAt: string;
  /** Hours since createdAt. */
  ageHours: number;
  /** SLA deadline in hours from createdAt; null if not tracked. */
  slaHours: number | null;
  /** True when SLA breach is imminent (<2h left or already past). */
  slaAtRisk: boolean;
  /** Steps completed in pipeline (0..4) — used for the dot bar visual. */
  progressSteps: number;
  /** Cost line for closed tickets — derived from related ledger entries when possible. Currently null. */
  closedCost: number | null;
  /** Most recent rating value 1..5 for closed tickets. */
  rating: number | null;
  commentCount: number;
  attachmentCount: number;
}

export interface MaintenanceKpis {
  critical: number;
  urgent: number; // HIGH
  inProgress: number;
  inProgressContractors: number;
  /** Average resolution duration across closed tickets (days). */
  avgResolutionDays: number | null;
  /** Sum of closedCost YTD for verified/completed tickets. */
  ytdCostFt: number;
  /** Number of tickets contributing to YTD cost. */
  ytdClosedCount: number;
}

export interface MaintenanceContractorCard {
  id: string;
  name: string;
  /** 2-letter logo. */
  initials: string;
  /** Specialty fragments split by " · ". */
  specialty: string;
  openCount: number;
  averageRating: number | null;
  /** "on_site" if any of their tickets is IN_PROGRESS, "contract" if has only ACKNOWLEDGED/ASSIGNED, "off" otherwise. */
  presence: "on_site" | "contract" | "off";
}

export interface MaintenanceActivityEvent {
  id: string;
  /** ISO. */
  at: string;
  /** Bucket for the colored avatar. */
  avatar: { initials: string; tone: "ink" | "moss" | "ochre" | "soft" };
  /** Bold subject ("Kovács László") + verb sentence ("kritikus hibabejelentést tett"). */
  subjectName: string;
  body: string;
  trackingNumber: string;
  ticketId: string;
  tag: "new" | "assigned" | "comment" | "scheduled" | "done" | "rated";
}

export interface CriticalHeroData {
  ticketId: string;
  trackingNumber: string;
  title: string;
  ageHours: number;
  /** "B lépcső, 14 lakás" — building meta. */
  locationLabel: string | null;
  contractorName: string | null;
  /** Total open critical count for the badge. */
  totalOpenCritical: number;
}

export interface MaintenanceOverviewData {
  isBoardPlus: boolean;
  kpis: MaintenanceKpis;
  critical: CriticalHeroData | null;
  /** Tickets per kanban column. */
  kanban: Record<KanbanColumn, MaintenanceTicketCard[]>;
  /** Counts shown in column headers (full counts including off-list pagination). */
  columnCounts: Record<KanbanColumn, number>;
  /** Flat list for the Lista view, deadline desc. */
  list: MaintenanceTicketCard[];
  contractors: MaintenanceContractorCard[];
  contractorTotalCount: number;
  activity: MaintenanceActivityEvent[];
  scheduledCount: number;
  /** Total open tickets across all columns. */
  totalOpenCount: number;
  /** Total open tickets the user can act on (board sees all, residents see own). */
  myOpenCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_COLUMN: Record<TicketStatusKey, KanbanColumn> = {
  SUBMITTED: "submitted",
  ACKNOWLEDGED: "acknowledged",
  ASSIGNED: "acknowledged",
  IN_PROGRESS: "in_progress",
  COMPLETED: "closed",
  VERIFIED: "closed",
};

const STATUS_PROGRESS: Record<TicketStatusKey, number> = {
  SUBMITTED: 0,
  ACKNOWLEDGED: 1,
  ASSIGNED: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  VERIFIED: 4,
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ageHoursOf(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 3_600_000));
}

function slaAtRisk(
  createdAt: Date,
  slaHours: number | null,
  now: Date,
): boolean {
  if (slaHours == null) return false;
  const elapsedH = (now.getTime() - createdAt.getTime()) / 3_600_000;
  return elapsedH > slaHours - 2;
}

function presenceOf(statuses: TicketStatusKey[]): "on_site" | "contract" | "off" {
  if (statuses.includes("IN_PROGRESS")) return "on_site";
  if (statuses.includes("ACKNOWLEDGED") || statuses.includes("ASSIGNED")) return "contract";
  return "off";
}

const ACTIVE_STATUSES: TicketStatusKey[] = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
];

// ─── Main loader ──────────────────────────────────────────────────────────

export const getMaintenanceOverview = cache(
  async (): Promise<MaintenanceOverviewData> => {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Residents see only their own tickets in the kanban/list views.
    const baseWhere = isBoardPlus
      ? { buildingId }
      : { buildingId, reporterId: userId };

    const [openTickets, closedRecent, contractors, recentTickets, recentComments, recentRatings, scheduledCount] =
      await Promise.all([
        prisma.maintenanceTicket.findMany({
          where: { ...baseWhere, status: { in: ACTIVE_STATUSES as TicketStatusKey[] } },
          include: {
            reporter: { select: { id: true, name: true } },
            assignedContractor: { select: { id: true, name: true } },
            _count: { select: { comments: true, attachments: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.maintenanceTicket.findMany({
          where: {
            ...baseWhere,
            status: { in: ["COMPLETED", "VERIFIED"] },
          },
          include: {
            reporter: { select: { id: true, name: true } },
            assignedContractor: { select: { id: true, name: true } },
            ratings: { select: { rating: true }, orderBy: { createdAt: "desc" }, take: 1 },
            _count: { select: { comments: true, attachments: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 12,
        }),
        prisma.contractor.findMany({
          include: {
            tickets: {
              where: {
                buildingId,
                status: { in: ACTIVE_STATUSES as TicketStatusKey[] },
              },
              select: { status: true },
            },
            ratings: { select: { rating: true } },
            _count: { select: { tickets: true } },
          },
        }),
        // Activity sources — board+ sees all, residents see only their own
        prisma.maintenanceTicket.findMany({
          where: baseWhere,
          include: {
            reporter: { select: { id: true, name: true } },
            assignedContractor: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
        prisma.ticketComment.findMany({
          where: {
            ticket: baseWhere,
            ...(isBoardPlus ? {} : { isInternal: false }),
          },
          include: {
            author: { select: { id: true, name: true } },
            ticket: { select: { id: true, trackingNumber: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
        prisma.contractorRating.findMany({
          where: { ticket: baseWhere },
          include: {
            rater: { select: { id: true, name: true } },
            ticket: { select: { id: true, trackingNumber: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        prisma.scheduledMaintenance.count({ where: { buildingId } }),
      ]);

    // ── Assemble ticket cards ─────────────────────────────────────────────
    const toCard = (
      t: (typeof openTickets)[number] | (typeof closedRecent)[number],
    ): MaintenanceTicketCard => {
      const assigneeName = t.assignedContractor?.name ?? null;
      const reporter = t.reporter;
      const initials = assigneeName
        ? initialsOf(assigneeName)
        : reporter
          ? initialsOf(reporter.name)
          : null;
      const ratings = "ratings" in t ? t.ratings : [];
      return {
        id: t.id,
        trackingNumber: t.trackingNumber,
        title: t.title,
        category: t.category as CategoryKey,
        urgency: t.urgency as UrgencyKey,
        status: t.status as TicketStatusKey,
        location: t.location ?? null,
        reporterName: t.reporter.name,
        assigneeName,
        assigneeInitials: initials,
        createdAt: t.createdAt.toISOString(),
        ageHours: ageHoursOf(t.createdAt, now),
        slaHours: t.slaHours,
        slaAtRisk: slaAtRisk(t.createdAt, t.slaHours, now),
        progressSteps: STATUS_PROGRESS[t.status as TicketStatusKey],
        closedCost: null,
        rating: ratings[0]?.rating ?? null,
        commentCount: t._count.comments,
        attachmentCount: t._count.attachments,
      };
    };

    const openCards = openTickets.map(toCard);
    const closedCards = closedRecent.map(toCard);

    const kanban: Record<KanbanColumn, MaintenanceTicketCard[]> = {
      submitted: [],
      acknowledged: [],
      in_progress: [],
      closed: [],
    };
    const columnCounts: Record<KanbanColumn, number> = {
      submitted: 0,
      acknowledged: 0,
      in_progress: 0,
      closed: 0,
    };
    for (const c of openCards) {
      const col = STATUS_COLUMN[c.status];
      if (col === "closed") continue;
      kanban[col].push(c);
      columnCounts[col]++;
    }
    for (const c of closedCards) {
      kanban.closed.push(c);
    }
    columnCounts.closed = closedCards.length;

    // Sort each column: critical first, then by ageHours desc.
    const urgencyRank: Record<UrgencyKey, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    for (const key of Object.keys(kanban) as KanbanColumn[]) {
      kanban[key].sort((a, b) => {
        const ur = urgencyRank[a.urgency] - urgencyRank[b.urgency];
        if (ur !== 0) return ur;
        return b.ageHours - a.ageHours;
      });
    }

    const list = [...openCards, ...closedCards].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // ── KPIs ──────────────────────────────────────────────────────────────
    const critical = openCards.filter((c) => c.urgency === "CRITICAL");
    const urgent = openCards.filter((c) => c.urgency === "HIGH");
    const inProgress = openCards.filter((c) => c.status === "IN_PROGRESS");
    const inProgressContractors = new Set(
      inProgress
        .map((c) => c.assigneeName)
        .filter((n): n is string => Boolean(n)),
    );

    // Average resolution: COMPLETED / VERIFIED tickets in this year.
    const closedThisYear = await prisma.maintenanceTicket.findMany({
      where: {
        ...baseWhere,
        status: { in: ["COMPLETED", "VERIFIED"] },
        updatedAt: { gte: yearStart },
      },
      select: { createdAt: true, updatedAt: true },
    });
    const avgResolutionDays =
      closedThisYear.length > 0
        ? Math.round(
            (closedThisYear.reduce(
              (sum, t) =>
                sum + (t.updatedAt.getTime() - t.createdAt.getTime()) / 86_400_000,
              0,
            ) /
              closedThisYear.length) *
              10,
          ) / 10
        : null;

    const kpis: MaintenanceKpis = {
      critical: critical.length,
      urgent: urgent.length,
      inProgress: inProgress.length,
      inProgressContractors: inProgressContractors.size,
      avgResolutionDays,
      ytdCostFt: 0,
      ytdClosedCount: closedThisYear.length,
    };

    // ── Critical hero (most-recent CRITICAL open ticket) ─────────────────
    const heroTicket = critical[0] ?? null;
    const criticalHero: CriticalHeroData | null = heroTicket
      ? {
          ticketId: heroTicket.id,
          trackingNumber: heroTicket.trackingNumber,
          title: heroTicket.title,
          ageHours: heroTicket.ageHours,
          locationLabel: heroTicket.location,
          contractorName: heroTicket.assigneeName,
          totalOpenCritical: critical.length,
        }
      : null;

    // ── Contractors strip ────────────────────────────────────────────────
    const contractorCards: MaintenanceContractorCard[] = contractors
      .map((c) => {
        const statuses = c.tickets.map((t) => t.status as TicketStatusKey);
        const avg =
          c.ratings.length > 0
            ? c.ratings.reduce((s, r) => s + r.rating, 0) / c.ratings.length
            : null;
        return {
          id: c.id,
          name: c.name,
          initials: initialsOf(c.name),
          specialty: c.specialty,
          openCount: c.tickets.length,
          averageRating: avg,
          presence: presenceOf(statuses),
        };
      })
      .sort((a, b) => {
        // Active first, then by openCount.
        const presenceRank = { on_site: 0, contract: 1, off: 2 } as const;
        const pr = presenceRank[a.presence] - presenceRank[b.presence];
        if (pr !== 0) return pr;
        return b.openCount - a.openCount;
      });

    // ── Activity feed (union of recent tickets + comments + ratings) ─────
    const events: MaintenanceActivityEvent[] = [];

    for (const t of recentTickets) {
      events.push({
        id: `t-${t.id}`,
        at: t.createdAt.toISOString(),
        avatar: {
          initials: initialsOf(t.reporter.name),
          tone: t.urgency === "CRITICAL" ? "ink" : "ochre",
        },
        subjectName: t.reporter.name,
        body:
          t.urgency === "CRITICAL"
            ? "kritikus hibabejelentést tett"
            : "új hibabejelentést tett",
        trackingNumber: t.trackingNumber,
        ticketId: t.id,
        tag: "new",
      });
      if (t.assignedContractor) {
        events.push({
          id: `a-${t.id}`,
          at: t.updatedAt.toISOString(),
          avatar: {
            initials: initialsOf(t.assignedContractor.name),
            tone: "moss",
          },
          subjectName: t.assignedContractor.name,
          body: "hozzárendelve a feladathoz",
          trackingNumber: t.trackingNumber,
          ticketId: t.id,
          tag: "assigned",
        });
      }
    }

    for (const c of recentComments) {
      events.push({
        id: `c-${c.id}`,
        at: c.createdAt.toISOString(),
        avatar: { initials: initialsOf(c.author.name), tone: "ochre" },
        subjectName: c.author.name,
        body: c.body.length > 80 ? c.body.slice(0, 80) + "…" : c.body,
        trackingNumber: c.ticket.trackingNumber,
        ticketId: c.ticket.id,
        tag: "comment",
      });
    }

    for (const r of recentRatings) {
      events.push({
        id: `r-${r.id}`,
        at: r.createdAt.toISOString(),
        avatar: { initials: initialsOf(r.rater.name), tone: "soft" },
        subjectName: r.rater.name,
        body: `értékelte a munkát: ${r.rating}/5 csillag`,
        trackingNumber: r.ticket.trackingNumber,
        ticketId: r.ticket.id,
        tag: "rated",
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const activity = events.slice(0, 6);

    return {
      isBoardPlus,
      kpis,
      critical: criticalHero,
      kanban,
      columnCounts,
      list,
      contractors: contractorCards.slice(0, 4),
      contractorTotalCount: contractorCards.length,
      activity,
      scheduledCount,
      totalOpenCount: openCards.length,
      myOpenCount: openCards.filter((t) => t.reporterName).length,
    };
  },
);

// ─── Ticket detail loader ─────────────────────────────────────────────────

export interface TicketDetailData {
  id: string;
  trackingNumber: string;
  title: string;
  description: string;
  category: CategoryKey;
  urgency: UrgencyKey;
  status: TicketStatusKey;
  location: string | null;
  slaHours: number | null;
  slaAtRisk: boolean;
  ageHours: number;
  createdAt: string;
  updatedAt: string;
  reporter: { id: string; name: string };
  contractor: { id: string; name: string; specialty: string } | null;
  attachments: { id: string; fileName: string; fileUrl: string }[];
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    authorName: string;
    authorInitials: string;
    createdAt: string;
  }[];
  ratings: { id: string; rating: number; raterName: string; notes: string | null; createdAt: string }[];
  /** Statuses already passed (used by the timeline). */
  timeline: { key: TicketStatusKey; reachedAt: string | null }[];
  /** Contractor options for the assign picker. Empty for non-board users. */
  contractorOptions: { id: string; name: string; specialty: string }[];
  /** When this ticket was auto-spawned from a scheduled entry, link back. */
  scheduledSource: {
    id: string;
    title: string;
    isRecurring: boolean;
    recurrenceMonths: number | null;
  } | null;
  isBoardPlus: boolean;
  isReporter: boolean;
  /** Building city/zip — needed to seed marketplace publications. */
  buildingCity: string;
  buildingZip: string;
  /** Current viewer's name + email — seeds the publish wizard's publisher fields. */
  viewer: { name: string; email: string };
  /** Contractor org id when the ticket was awarded via the marketplace. */
  awardedContractorOrgId: string | null;
  /** Existing rating row by the viewer for the marketplace-awarded contractor. */
  viewerRating: { rating: number; notes: string | null } | null;
  /** Marketplace publication summary, if this ticket has been published. */
  publication: {
    id: string;
    status: "DRAFT" | "OPEN" | "AWARDED" | "CLOSED";
    bidsCount: number;
    publishedAt: string;
    deadlineAt: string | null;
    awardedAt: string | null;
    closedAt: string | null;
  } | null;
}

export const getTicketDetail = cache(
  async (ticketId: string): Promise<TicketDetailData | null> => {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
      include: {
        reporter: { select: { id: true, name: true } },
        assignedContractor: true,
        attachments: { orderBy: { createdAt: "asc" } },
        comments: {
          where: isBoardPlus ? {} : { isInternal: false },
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        ratings: {
          include: { rater: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        scheduledMaintenance: {
          select: {
            id: true,
            title: true,
            isRecurring: true,
            recurrenceMonths: true,
          },
        },
        building: { select: { city: true, zipCode: true } },
        publication: {
          select: {
            id: true,
            status: true,
            publishedAt: true,
            deadlineAt: true,
            awardedAt: true,
            closedAt: true,
            _count: { select: { bids: true } },
          },
        },
      },
    });

    if (!ticket || ticket.buildingId !== buildingId) return null;
    if (!isBoardPlus && ticket.reporterId !== userId) return null;

    const viewer = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Has the viewer already rated this marketplace contractor?
    const viewerRatingRow = ticket.awardedContractorId
      ? await prisma.contractorRating.findFirst({
          where: {
            ticketId: ticket.id,
            raterId: userId,
            contractorOrgId: ticket.awardedContractorId,
          },
          select: { rating: true, notes: true },
        })
      : null;

    const contractorOptions = isBoardPlus
      ? await prisma.contractor.findMany({
          select: { id: true, name: true, specialty: true },
          orderBy: { name: "asc" },
        })
      : [];

    const now = new Date();

    // Approximate timeline: SUBMITTED reached at createdAt, current status reached at updatedAt.
    const order: TicketStatusKey[] = [
      "SUBMITTED",
      "ACKNOWLEDGED",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "VERIFIED",
    ];
    const currentIdx = order.indexOf(ticket.status as TicketStatusKey);
    const timeline = order.map((key, i) => {
      if (i === 0) return { key, reachedAt: ticket.createdAt.toISOString() };
      if (i === currentIdx) return { key, reachedAt: ticket.updatedAt.toISOString() };
      if (i < currentIdx) {
        // Best-effort interpolation between createdAt and updatedAt.
        const fraction = i / Math.max(1, currentIdx);
        const t =
          ticket.createdAt.getTime() +
          fraction * (ticket.updatedAt.getTime() - ticket.createdAt.getTime());
        return { key, reachedAt: new Date(t).toISOString() };
      }
      return { key, reachedAt: null };
    });

    return {
      id: ticket.id,
      trackingNumber: ticket.trackingNumber,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category as CategoryKey,
      urgency: ticket.urgency as UrgencyKey,
      status: ticket.status as TicketStatusKey,
      location: ticket.location,
      slaHours: ticket.slaHours,
      slaAtRisk: slaAtRisk(ticket.createdAt, ticket.slaHours, now),
      ageHours: ageHoursOf(ticket.createdAt, now),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      reporter: { id: ticket.reporter.id, name: ticket.reporter.name },
      contractor: ticket.assignedContractor
        ? {
            id: ticket.assignedContractor.id,
            name: ticket.assignedContractor.name,
            specialty: ticket.assignedContractor.specialty,
          }
        : null,
      attachments: ticket.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
      })),
      comments: ticket.comments.map((c) => ({
        id: c.id,
        body: c.body,
        isInternal: c.isInternal,
        authorName: c.author.name,
        authorInitials: initialsOf(c.author.name),
        createdAt: c.createdAt.toISOString(),
      })),
      ratings: ticket.ratings.map((r) => ({
        id: r.id,
        rating: r.rating,
        raterName: r.rater.name,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      })),
      timeline,
      contractorOptions,
      scheduledSource: ticket.scheduledMaintenance
        ? {
            id: ticket.scheduledMaintenance.id,
            title: ticket.scheduledMaintenance.title,
            isRecurring: ticket.scheduledMaintenance.isRecurring,
            recurrenceMonths: ticket.scheduledMaintenance.recurrenceMonths,
          }
        : null,
      isBoardPlus,
      isReporter: ticket.reporterId === userId,
      buildingCity: ticket.building.city,
      buildingZip: ticket.building.zipCode,
      viewer: { name: viewer?.name ?? "", email: viewer?.email ?? "" },
      awardedContractorOrgId: ticket.awardedContractorId ?? null,
      viewerRating: viewerRatingRow
        ? { rating: viewerRatingRow.rating, notes: viewerRatingRow.notes }
        : null,
      publication: ticket.publication
        ? {
            id: ticket.publication.id,
            status: ticket.publication.status as
              | "DRAFT"
              | "OPEN"
              | "AWARDED"
              | "CLOSED",
            bidsCount: ticket.publication._count.bids,
            publishedAt: ticket.publication.publishedAt.toISOString(),
            deadlineAt: ticket.publication.deadlineAt
              ? ticket.publication.deadlineAt.toISOString()
              : null,
            awardedAt: ticket.publication.awardedAt
              ? ticket.publication.awardedAt.toISOString()
              : null,
            closedAt: ticket.publication.closedAt
              ? ticket.publication.closedAt.toISOString()
              : null,
          }
        : null,
    };
  },
);

// ─── Contractors list loader ──────────────────────────────────────────────

export interface ContractorListItem {
  id: string;
  name: string;
  specialty: string;
  contactInfo: string;
  taxId: string | null;
  initials: string;
  averageRating: number | null;
  totalRatings: number;
  totalJobs: number;
  openCount: number;
  presence: "on_site" | "contract" | "off";
  createdAt: string;
}

export interface ContractorListData {
  items: ContractorListItem[];
  isAdmin: boolean;
  isBoardPlus: boolean;
}

export const getContractorList = cache(async (): Promise<ContractorListData> => {
  const ctx = await requireBuildingContext();
  const { buildingId } = ctx;
  const isBoardPlus = allows(ctx, "view.boardContext");

  const contractors = await prisma.contractor.findMany({
    include: {
      tickets: {
        where: {
          buildingId,
          status: { in: ACTIVE_STATUSES as TicketStatusKey[] },
        },
        select: { status: true },
      },
      ratings: { select: { rating: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { name: "asc" },
  });

  return {
    items: contractors.map((c) => ({
      id: c.id,
      name: c.name,
      specialty: c.specialty,
      contactInfo: c.contactInfo,
      taxId: c.taxId,
      initials: initialsOf(c.name),
      averageRating:
        c.ratings.length > 0
          ? c.ratings.reduce((s, r) => s + r.rating, 0) / c.ratings.length
          : null,
      totalRatings: c.ratings.length,
      totalJobs: c._count.tickets,
      openCount: c.tickets.length,
      presence: presenceOf(c.tickets.map((t) => t.status as TicketStatusKey)),
      createdAt: c.createdAt.toISOString(),
    })),
    isAdmin: allows(ctx, "view.adminContext"),
    isBoardPlus,
  };
});

// ─── Scheduled maintenance loader ─────────────────────────────────────────

export interface ScheduledItem {
  id: string;
  title: string;
  description: string | null;
  date: string;
  isRecurring: boolean;
  /** Months between occurrences when recurring. */
  recurrenceMonths: number | null;
  /** Days before `date` to materialize a ticket. */
  leadTimeDays: number;
  /** When the most recent ticket was spawned. */
  materializedAt: string | null;
  /** Days from now to `date` (negative = past). */
  daysFromNow: number;
  /** Days from now to the next ticket-materialization moment (date - leadTimeDays). */
  daysToNextFire: number;
}

export interface ScheduledMaintenanceListData {
  upcoming: ScheduledItem[];
  past: ScheduledItem[];
  isBoardPlus: boolean;
  totalCount: number;
}

export const getScheduledList = cache(
  async (): Promise<ScheduledMaintenanceListData> => {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    const isBoardPlus = allows(ctx, "view.boardContext");

    const items = await prisma.scheduledMaintenance.findMany({
      where: { buildingId },
      orderBy: { date: "asc" },
    });

    const now = new Date();
    const cards: ScheduledItem[] = items.map((item) => {
      const fireMs = item.date.getTime() - item.leadTimeDays * 86_400_000;
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        date: item.date.toISOString(),
        isRecurring: item.isRecurring,
        recurrenceMonths: item.recurrenceMonths,
        leadTimeDays: item.leadTimeDays,
        materializedAt: item.materializedAt?.toISOString() ?? null,
        daysFromNow: Math.floor(
          (item.date.getTime() - now.getTime()) / 86_400_000,
        ),
        daysToNextFire: Math.floor((fireMs - now.getTime()) / 86_400_000),
      };
    });

    return {
      upcoming: cards.filter((c) => c.daysFromNow >= 0),
      past: cards.filter((c) => c.daysFromNow < 0),
      isBoardPlus,
      totalCount: cards.length,
    };
  },
);

// ────────────────────────────────────────────────────────────────────────
// /api/maintenance/tickets/[id] route — DAL functions
// ────────────────────────────────────────────────────────────────────────

/**
 * Cross-tenant safe detail fetch — returns null if `id` doesn't belong
 * to `buildingId`, even if the ticket exists. Includes everything the
 * board ticket-detail view needs in one query.
 */
export async function findTicketForDetail(opts: {
  id: string;
  buildingId: string;
  /** Internal comments hidden from non-board roles. */
  includeInternalComments: boolean;
}) {
  return prisma.maintenanceTicket.findFirst({
    where: { id: opts.id, buildingId: opts.buildingId },
    include: {
      reporter: { select: { id: true, name: true } },
      assignedContractor: true,
      attachments: { orderBy: { createdAt: "asc" } },
      comments: {
        where: opts.includeInternalComments ? {} : { isInternal: false },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      ratings: {
        include: { rater: { select: { id: true, name: true } } },
      },
    },
  });
}

/**
 * Cross-tenant safe pre-update fetch — minimum fields the PATCH handler
 * needs to validate the transition and stamp the audit log.
 */
export async function findTicketForStatusUpdate(opts: {
  id: string;
  buildingId: string;
}) {
  return prisma.maintenanceTicket.findFirst({
    where: { id: opts.id, buildingId: opts.buildingId },
    select: {
      id: true,
      status: true,
      reporterId: true,
      trackingNumber: true,
      buildingId: true,
    },
  });
}

/**
 * Status update with the includes the route returns to the client. The
 * route still owns transition validation — this is a pass-through.
 */
export async function updateTicketStatus(opts: {
  id: string;
  status: TicketStatusKey;
}) {
  return prisma.maintenanceTicket.update({
    where: { id: opts.id },
    data: { status: opts.status },
    include: {
      reporter: { select: { id: true, name: true } },
      assignedContractor: { select: { id: true, name: true } },
    },
  });
}

/**
 * Cross-tenant safe ticket fetch for the BidReviewPage RSC. Returns
 * null when the ticket doesn't belong to `buildingId`.
 */
export async function findTicketForBidReview(opts: {
  id: string;
  buildingId: string;
}) {
  return prisma.maintenanceTicket.findFirst({
    where: { id: opts.id, buildingId: opts.buildingId },
    select: {
      buildingId: true,
      title: true,
      publication: {
        select: {
          id: true,
          status: true,
          scrubbedTitle: true,
          deadlineAt: true,
          publishedAt: true,
        },
      },
    },
  });
}
