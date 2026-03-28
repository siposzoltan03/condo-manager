import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ topicId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { topicId } = await context.params;

    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: {
        author: {
          select: { name: true, role: true },
        },
        category: {
          select: { id: true, name: true, buildingId: true },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    if (!topic || topic.category.buildingId !== buildingId) {
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
    const { userId, buildingId, role } = await requireBuildingContext();

    const { topicId } = await context.params;

    const existing = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: { category: { select: { buildingId: true } } },
    });

    if (!existing || existing.category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    const isAuthor = existing.authorId === userId;
    const isAdmin = hasMinimumRole(role, "ADMIN");

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
      userId,
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
    const { userId, buildingId, role } = await requireBuildingContext();

    const { topicId } = await context.params;

    const existing = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      include: { category: { select: { buildingId: true } } },
    });

    if (!existing || existing.category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    const isAuthor = existing.authorId === userId;
    const isAdmin = hasMinimumRole(role, "ADMIN");
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cascade deletes replies via onDelete: Cascade in schema
    await prisma.forumTopic.delete({ where: { id: topicId } });

    await createAuditLog({
      entityType: "ForumTopic",
      entityId: topicId,
      action: "DELETE",
      userId,
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
