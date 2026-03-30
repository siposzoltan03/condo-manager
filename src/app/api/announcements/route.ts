import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma, TargetAudience } from "@prisma/client";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const audience = searchParams.get("audience") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.AnnouncementWhereInput = { buildingId };

    // Filter by audience visibility based on user role
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
    if (!isBoardPlus) {
      // TENANT/RESIDENT can only see ALL and SPECIFIC_UNITS
      where.targetAudience = { in: ["ALL", "SPECIFIC_UNITS"] };
    }

    // Filter by audience query param (respect role restrictions)
    if (audience && ["ALL", "BOARD_ONLY", "SPECIFIC_UNITS"].includes(audience)) {
      if (audience === "BOARD_ONLY" && !isBoardPlus) {
        // Non-board users cannot filter by BOARD_ONLY — keep restricted set
      } else {
        where.targetAudience = audience as TargetAudience;
      }
    }

    // Search in title or body
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          author: {
            select: { name: true },
          },
          reads: {
            where: { userId },
            select: { id: true },
          },
          _count: {
            select: { reads: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    const result = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      targetAudience: a.targetAudience,
      attachments: a.attachments,
      author: a.author,
      isRead: a.reads.length > 0,
      readCount: a._count.reads,
      attachmentCount: Array.isArray(a.attachments) ? (a.attachments as unknown[]).length : 0,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return NextResponse.json({
      announcements: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireNotFrozen(buildingId);
    } catch (e) {
      if (e instanceof FrozenBuildingError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, body: announcementBody, targetAudience, attachments } = body;

    if (!title || !announcementBody) {
      return NextResponse.json(
        { error: "Missing required fields: title, body" },
        { status: 400 }
      );
    }

    if (
      targetAudience &&
      !["ALL", "SPECIFIC_UNITS", "BOARD_ONLY"].includes(targetAudience)
    ) {
      return NextResponse.json(
        { error: "Invalid targetAudience" },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        body: announcementBody,
        targetAudience: targetAudience ?? "ALL",
        attachments: attachments ?? [],
        authorId: userId,
        buildingId,
      },
      include: {
        author: {
          select: { name: true },
        },
      },
    });

    await createAuditLog({
      entityType: "Announcement",
      entityId: announcement.id,
      action: "CREATE",
      userId,
      newValue: { title, targetAudience: targetAudience ?? "ALL" },
    });

    // Notify users based on audience
    const effectiveAudience = targetAudience ?? "ALL";
    // Notify users in this building
    const buildingUsers = await prisma.userBuilding.findMany({
      where: { buildingId, userId: { not: userId } },
      select: { userId: true, role: true },
    });

    let targetUserIds = buildingUsers.map((u) => u.userId);

    if (effectiveAudience === "BOARD_ONLY") {
      const boardRoles = ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"];
      targetUserIds = buildingUsers
        .filter((u) => boardRoles.includes(u.role))
        .map((u) => u.userId);
    }

    const targetUsers = targetUserIds.map((id) => ({ id }));

    if (targetUsers.length > 0) {
      await notify({
        userIds: targetUserIds,
        type: NotificationType.ANNOUNCEMENT_NEW,
        title: `New Announcement: ${title}`,
        body: announcementBody.substring(0, 200),
        entityType: "Announcement",
        entityId: announcement.id,
      });
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
