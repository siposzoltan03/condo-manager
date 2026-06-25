import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Complaints Data Access Layer (flat file, like the other condo DALs —
 * will fold into `lib/complaints/dal.ts` when the domain gets a folder
 * shape; see plan §4 #3).
 */

/**
 * Cross-tenant + private-visibility safe complaint fetch.
 *
 * Returns null when:
 *   - The complaint doesn't exist
 *   - It belongs to a different building
 *   - It's private AND the viewer is neither the author nor BOARD_MEMBER+
 *
 * Filter logic lives at the DB layer (`OR: [isPrivate=false, ...]`) so
 * a leaked complaint id can't bypass the privacy check.
 */
export async function findComplaintForViewer(opts: {
  id: string;
  buildingId: string;
  viewerUserId: string;
  isBoardPlus: boolean;
}) {
  const visibility = opts.isBoardPlus
    ? {}
    : {
        OR: [{ isPrivate: false }, { authorId: opts.viewerUserId }],
      };

  return prisma.complaint.findFirst({
    where: {
      id: opts.id,
      buildingId: opts.buildingId,
      ...visibility,
    },
    include: {
      author: { select: { id: true, name: true } },
      category: {
        select: { id: true, name: true, slug: true, icon: true },
      },
      respondentUnit: {
        select: { id: true, number: true, stairwell: true, floor: true },
      },
      pendingAgenda: {
        include: {
          attachedMeeting: {
            select: { id: true, title: true, date: true },
          },
        },
      },
      notes: {
        where: opts.isBoardPlus ? {} : { isInternal: false },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      statusEvents: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/**
 * Lightweight access check (no joins) for note-list and note-create flows.
 * Returns null on cross-tenant or private-and-not-allowed.
 */
export async function findComplaintForAccess(opts: {
  id: string;
  buildingId: string;
  viewerUserId: string;
  isBoardPlus: boolean;
}) {
  const visibility = opts.isBoardPlus
    ? {}
    : {
        OR: [{ isPrivate: false }, { authorId: opts.viewerUserId }],
      };
  return prisma.complaint.findFirst({
    where: { id: opts.id, buildingId: opts.buildingId, ...visibility },
    select: {
      id: true,
      isPrivate: true,
      authorId: true,
      trackingNumber: true,
    },
  });
}

export async function listComplaintNotes(opts: {
  complaintId: string;
  includeInternal: boolean;
}) {
  return prisma.complaintNote.findMany({
    where: {
      complaintId: opts.complaintId,
      ...(opts.includeInternal ? {} : { isInternal: false }),
    },
    include: {
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createComplaintNote(opts: {
  complaintId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
}) {
  return prisma.complaintNote.create({
    data: {
      body: opts.body,
      isInternal: opts.isInternal,
      complaint: { connect: { id: opts.complaintId } },
      author: { connect: { id: opts.authorId } },
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });
}

/**
 * Board members in a building, used for "author posted, notify board".
 */
export async function listBuildingBoardMemberIds(
  buildingId: string,
  excludeUserId?: string,
) {
  const rows = await prisma.userBuilding.findMany({
    where: {
      buildingId,
      role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/**
 * Build the visibility-aware where clause used by both the list and
 * detail surfaces. Extracted for symmetry — keeps the privacy filter
 * in one place.
 */
function visibilityClause(opts: {
  buildingId: string;
  viewerUserId: string;
  isBoardPlus: boolean;
}): import("@prisma/client").Prisma.ComplaintWhereInput {
  if (opts.isBoardPlus) return { buildingId: opts.buildingId };
  return {
    buildingId: opts.buildingId,
    OR: [{ isPrivate: false }, { authorId: opts.viewerUserId }],
  };
}

export async function listComplaintsPaginated(opts: {
  buildingId: string;
  viewerUserId: string;
  isBoardPlus: boolean;
  search?: string;
  status?: import("@prisma/client").ComplaintStatus;
  categoryId?: string;
  skip: number;
  limit: number;
}) {
  const visibility = visibilityClause({
    buildingId: opts.buildingId,
    viewerUserId: opts.viewerUserId,
    isBoardPlus: opts.isBoardPlus,
  });

  const filters: import("@prisma/client").Prisma.ComplaintWhereInput[] = [
    visibility,
  ];
  if (opts.search) {
    filters.push({
      OR: [
        { description: { contains: opts.search, mode: "insensitive" } },
        { title: { contains: opts.search, mode: "insensitive" } },
        { trackingNumber: { contains: opts.search, mode: "insensitive" } },
      ],
    });
  }
  if (opts.status) filters.push({ status: opts.status });
  if (opts.categoryId) filters.push({ categoryId: opts.categoryId });

  const where: import("@prisma/client").Prisma.ComplaintWhereInput = {
    AND: filters,
  };

  const [complaints, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        respondentUnit: { select: { id: true, number: true, stairwell: true } },
        _count: { select: { notes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: opts.skip,
      take: opts.limit,
    }),
    prisma.complaint.count({ where }),
  ]);

  return { complaints, total };
}

export async function findActiveCategoryInBuilding(
  categoryId: string,
  buildingId: string,
) {
  return prisma.complaintCategory.findFirst({
    where: { id: categoryId, buildingId, isActive: true },
    select: { id: true },
  });
}

export async function findUnitForRespondent(
  unitId: string,
  buildingId: string,
) {
  return prisma.unit.findFirst({
    where: { id: unitId, buildingId },
    select: { id: true },
  });
}

export async function findLastComplaintTrackingNumber(prefix: string) {
  return prisma.complaint.findFirst({
    where: { trackingNumber: { startsWith: prefix } },
    orderBy: { trackingNumber: "desc" },
    select: { trackingNumber: true },
  });
}

export async function createComplaintWithStatusEvent(input: {
  trackingNumber: string;
  title: string | null;
  description: string;
  photos: unknown[];
  isPrivate: boolean;
  authorId: string;
  buildingId: string;
  categoryId: string;
  respondentUnitId: string | null;
}) {
  return prisma.complaint.create({
    data: {
      trackingNumber: input.trackingNumber,
      title: input.title,
      description: input.description,
      photos: input.photos as import("@prisma/client").Prisma.InputJsonValue,
      isPrivate: input.isPrivate,
      author: { connect: { id: input.authorId } },
      building: { connect: { id: input.buildingId } },
      category: { connect: { id: input.categoryId } },
      ...(input.respondentUnitId
        ? { respondentUnit: { connect: { id: input.respondentUnitId } } }
        : {}),
      statusEvents: {
        create: {
          fromStatus: null,
          toStatus: "REPORTED",
          actorId: input.authorId,
        },
      },
    },
    include: {
      author: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true, icon: true } },
    },
  });
}
