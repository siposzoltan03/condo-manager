import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const audience = searchParams.get("audience") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.AnnouncementWhereInput = {};

    // Filter by audience visibility based on user role
    const isBoardPlus = hasMinimumRole(user.role, "BOARD_MEMBER");
    if (!isBoardPlus) {
      // TENANT/RESIDENT can only see ALL and SPECIFIC_UNITS
      where.targetAudience = { in: ["ALL", "SPECIFIC_UNITS"] };
    }

    // Filter by audience query param
    if (audience && ["ALL", "BOARD_ONLY", "SPECIFIC_UNITS"].includes(audience)) {
      where.targetAudience = audience as Prisma.EnumTargetAudienceFilter;
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
            where: { userId: user.id },
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireRole(user.role, "BOARD_MEMBER");
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
        authorId: user.id,
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
      userId: user.id,
      newValue: { title, targetAudience: targetAudience ?? "ALL" },
    });

    // Notify users based on audience
    const effectiveAudience = targetAudience ?? "ALL";
    const userFilter: Prisma.UserWhereInput = { isActive: true, id: { not: user.id } };

    if (effectiveAudience === "BOARD_ONLY") {
      userFilter.role = { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] };
    }

    const targetUsers = await prisma.user.findMany({
      where: userFilter,
      select: { id: true },
    });

    if (targetUsers.length > 0) {
      await notify({
        userIds: targetUsers.map((u) => u.id),
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
