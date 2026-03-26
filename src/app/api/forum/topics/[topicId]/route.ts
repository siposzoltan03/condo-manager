import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ topicId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topicId } = await context.params;

    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: {
        author: {
          select: { name: true, role: true },
        },
        category: {
          select: { id: true, name: true },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: topic.id,
      title: topic.title,
      body: topic.body,
      categoryId: topic.categoryId,
      category: topic.category,
      author: topic.author,
      authorId: topic.authorId,
      isPinned: topic.isPinned,
      isLocked: topic.isLocked,
      replyCount: topic._count.replies,
      lastActivityAt: topic.lastActivityAt,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch forum topic:", error);
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

    const { topicId } = await context.params;

    const existing = await prisma.forumTopic.findUnique({
      where: { id: topicId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    const isAuthor = existing.authorId === user.id;
    const isAdmin = hasMinimumRole(user.role, "ADMIN");

    const body = await request.json();
    const { title, body: topicBody, isPinned, isLocked } = body;

    const updateData: Record<string, unknown> = {};

    // Only admin can toggle pin/lock
    if (isPinned !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      updateData.isPinned = isPinned;
    }

    if (isLocked !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      updateData.isLocked = isLocked;
    }

    // Author or admin can edit title/body
    if (title !== undefined || topicBody !== undefined) {
      if (!isAuthor && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (title !== undefined) updateData.title = title;
      if (topicBody !== undefined) updateData.body = topicBody;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.forumTopic.update({
      where: { id: topicId },
      data: updateData,
      include: {
        author: {
          select: { name: true, role: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      entityType: "ForumTopic",
      entityId: topicId,
      action: "UPDATE",
      userId: user.id,
      oldValue: {
        title: existing.title,
        body: existing.body,
        isPinned: existing.isPinned,
        isLocked: existing.isLocked,
      },
      newValue: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update forum topic:", error);
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

    const { topicId } = await context.params;

    const existing = await prisma.forumTopic.findUnique({
      where: { id: topicId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    const isAuthor = existing.authorId === user.id;
    const isAdmin = hasMinimumRole(user.role, "ADMIN");
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cascade deletes replies via onDelete: Cascade in schema
    await prisma.forumTopic.delete({ where: { id: topicId } });

    await createAuditLog({
      entityType: "ForumTopic",
      entityId: topicId,
      action: "DELETE",
      userId: user.id,
      oldValue: { title: existing.title, categoryId: existing.categoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete forum topic:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
