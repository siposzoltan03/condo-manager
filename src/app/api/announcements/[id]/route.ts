import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        author: {
          select: { name: true, role: true },
        },
        _count: {
          select: { reads: true },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // BOARD_ONLY announcements hidden from non-board users
    if (
      announcement.targetAudience === "BOARD_ONLY" &&
      !hasMinimumRole(user.role, "BOARD_MEMBER")
    ) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Check if current user has read this
    const readRecord = await prisma.announcementRead.findUnique({
      where: {
        userId_announcementId: {
          userId: user.id,
          announcementId: id,
        },
      },
    });

    return NextResponse.json({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      targetAudience: announcement.targetAudience,
      attachments: announcement.attachments,
      author: announcement.author,
      authorId: announcement.authorId,
      isRead: !!readRecord,
      readCount: announcement._count.reads,
      attachmentCount: Array.isArray(announcement.attachments)
        ? (announcement.attachments as unknown[]).length
        : 0,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Author or ADMIN+ can update
    const isAuthor = existing.authorId === user.id;
    const isAdmin = hasMinimumRole(user.role, "ADMIN");
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, body: announcementBody, targetAudience } = body;

    if (
      targetAudience &&
      !["ALL", "SPECIFIC_UNITS", "BOARD_ONLY"].includes(targetAudience)
    ) {
      return NextResponse.json(
        { error: "Invalid targetAudience" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (announcementBody !== undefined) updateData.body = announcementBody;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;

    const updated = await prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { name: true, role: true },
        },
      },
    });

    await createAuditLog({
      entityType: "Announcement",
      entityId: id,
      action: "UPDATE",
      userId: user.id,
      oldValue: {
        title: existing.title,
        body: existing.body,
        targetAudience: existing.targetAudience,
      },
      newValue: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const existing = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Author or ADMIN+ can delete
    const isAuthor = existing.authorId === user.id;
    const isAdmin = hasMinimumRole(user.role, "ADMIN");
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hard delete (cascades to reads via onDelete: Cascade)
    await prisma.announcement.delete({ where: { id } });

    await createAuditLog({
      entityType: "Announcement",
      entityId: id,
      action: "DELETE",
      userId: user.id,
      oldValue: {
        title: existing.title,
        targetAudience: existing.targetAudience,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
