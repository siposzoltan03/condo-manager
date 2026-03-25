import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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
    const { searchParams } = request.nextUrl;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);
    const skip = (page - 1) * limit;

    // Verify topic exists
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { id: true },
    });

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    const [replies, total] = await Promise.all([
      prisma.forumReply.findMany({
        where: { topicId },
        include: {
          author: {
            select: { name: true, role: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.forumReply.count({ where: { topicId } }),
    ]);

    const result = replies.map((r) => ({
      id: r.id,
      body: r.body,
      author: r.author,
      authorId: r.authorId,
      parentReplyId: r.parentReplyId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({
      replies: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch forum replies:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topicId } = await context.params;

    // Verify topic exists and check lock status
    const topic = await prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { id: true, isLocked: true },
    });

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    if (topic.isLocked) {
      return NextResponse.json(
        { error: "Topic is locked" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { body: replyBody, parentReplyId } = body;

    if (!replyBody) {
      return NextResponse.json(
        { error: "Missing required field: body" },
        { status: 400 }
      );
    }

    // Verify parent reply if provided
    if (parentReplyId) {
      const parentReply = await prisma.forumReply.findUnique({
        where: { id: parentReplyId },
        select: { topicId: true },
      });

      if (!parentReply || parentReply.topicId !== topicId) {
        return NextResponse.json(
          { error: "Parent reply not found in this topic" },
          { status: 400 }
        );
      }
    }

    const [reply] = await Promise.all([
      prisma.forumReply.create({
        data: {
          body: replyBody,
          topicId,
          authorId: user.id,
          parentReplyId: parentReplyId ?? null,
        },
        include: {
          author: {
            select: { name: true, role: true },
          },
        },
      }),
      prisma.forumTopic.update({
        where: { id: topicId },
        data: { lastActivityAt: new Date() },
      }),
    ]);

    return NextResponse.json(
      {
        id: reply.id,
        body: reply.body,
        author: reply.author,
        authorId: reply.authorId,
        parentReplyId: reply.parentReplyId,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create forum reply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
