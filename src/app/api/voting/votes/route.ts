import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { VoteStatus } from "@prisma/client";
import { votingQueue } from "@/lib/queue";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) {
      if (!Object.values(VoteStatus).includes(status as VoteStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      where.status = status;
    }

    const [votes, total] = await Promise.all([
      prisma.vote.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          options: { orderBy: { sortOrder: "asc" } },
          _count: { select: { ballots: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.vote.count({ where }),
    ]);

    // Check if user's unit already voted on each vote
    const voteIds = votes.map((v) => v.id);
    const existingBallots = await prisma.ballot.findMany({
      where: {
        voteId: { in: voteIds },
        unitId: user.unitId!, // TODO: Task 5 — resolve unit from building context
      },
      select: { voteId: true, optionId: true, receiptHash: true },
    });

    const ballotMap = new Map(existingBallots.map((b) => [b.voteId, b]));

    const result = votes.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      voteType: v.voteType,
      status: v.status,
      isSecret: v.isSecret,
      quorumRequired: Number(v.quorumRequired),
      deadline: v.deadline,
      meetingId: v.meetingId,
      createdBy: v.createdBy,
      options: v.options.map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
      ballotCount: v._count.ballots,
      myBallot: ballotMap.get(v.id)
        ? {
            optionId: ballotMap.get(v.id)!.optionId,
            receiptHash: ballotMap.get(v.id)!.receiptHash,
          }
        : null,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    return NextResponse.json({
      votes: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch votes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    const {
      title,
      description,
      voteType,
      isSecret,
      quorumRequired,
      deadline,
      meetingId,
      options,
    } = body;

    if (!title || !deadline || !options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "Missing required fields: title, deadline, options (at least 2)" },
        { status: 400 }
      );
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return NextResponse.json(
        { error: "Deadline must be in the future" },
        { status: 400 }
      );
    }

    const vote = await prisma.vote.create({
      data: {
        title,
        description: description ?? null,
        voteType: voteType ?? "YES_NO",
        status: "OPEN",
        isSecret: isSecret ?? false,
        quorumRequired: quorumRequired ?? 0.51,
        deadline: deadlineDate,
        meetingId: meetingId ?? null,
        createdById: user.id,
        options: {
          create: options.map((opt: { label: string }, index: number) => ({
            label: opt.label,
            sortOrder: index,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Schedule auto-close job
    const delay = deadlineDate.getTime() - Date.now();
    await votingQueue.add(
      "vote-auto-close",
      { voteId: vote.id },
      {
        delay,
        jobId: `vote-close-${vote.id}`,
      }
    );

    await createAuditLog({
      entityType: "Vote",
      entityId: vote.id,
      action: "CREATE",
      userId: user.id,
      newValue: { title, voteType: vote.voteType, deadline, isSecret: vote.isSecret },
    });

    // Notify all active users about the new vote
    const targetUsers = await prisma.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: { id: true },
    });

    if (targetUsers.length > 0) {
      await notify({
        userIds: targetUsers.map((u) => u.id),
        type: NotificationType.VOTE_OPEN,
        title: `New Vote: ${title}`,
        body: description?.substring(0, 200) ?? title,
        entityType: "Vote",
        entityId: vote.id,
      });
    }

    return NextResponse.json(vote, { status: 201 });
  } catch (error) {
    console.error("Failed to create vote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
