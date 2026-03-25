import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    if (!categoryId) {
      return NextResponse.json(
        { error: "categoryId is required" },
        { status: 400 }
      );
    }

    const where: Prisma.ForumTopicWhereInput = { categoryId };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const [topics, total] = await Promise.all([
      prisma.forumTopic.findMany({
        where,
        include: {
          author: {
            select: { name: true, unitId: true },
          },
          category: {
            select: { name: true },
          },
          _count: {
            select: { replies: true },
          },
        },
        orderBy: [
          { isPinned: "desc" },
          { lastActivityAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.forumTopic.count({ where }),
    ]);

    const result = topics.map((t) => ({
      id: t.id,
      title: t.title,
      categoryId: t.categoryId,
      categoryName: t.category.name,
      author: t.author,
      authorId: t.authorId,
      isPinned: t.isPinned,
      isLocked: t.isLocked,
      replyCount: t._count.replies,
      lastActivityAt: t.lastActivityAt,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({
      topics: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch forum topics:", error);
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

    const body = await request.json();
    const { title, body: topicBody, categoryId } = body;

    if (!title || !topicBody || !categoryId) {
      return NextResponse.json(
        { error: "Missing required fields: title, body, categoryId" },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await prisma.forumCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const topic = await prisma.forumTopic.create({
      data: {
        title,
        body: topicBody,
        categoryId,
        authorId: user.id,
        lastActivityAt: new Date(),
      },
      include: {
        author: {
          select: { name: true },
        },
        category: {
          select: { name: true },
        },
      },
    });

    await createAuditLog({
      entityType: "ForumTopic",
      entityId: topic.id,
      action: "CREATE",
      userId: user.id,
      newValue: { title, categoryId },
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    console.error("Failed to create forum topic:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
