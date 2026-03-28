import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { calculateQuorum, calculateResults } from "@/lib/voting/quorum";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const vote = await prisma.vote.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
        _count: { select: { ballots: true } },
      },
    });

    if (!vote) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    const quorum = await calculateQuorum(id);

    // Check if user's unit already voted
    const myBallot = await prisma.ballot.findUnique({
      where: { voteId_unitId: { voteId: id, unitId: user.unitId } },
      select: { optionId: true, receiptHash: true },
    });

    // Get user's unit ownership share for display
    const unit = await prisma.unit.findUnique({
      where: { id: user.unitId },
      select: { ownershipShare: true },
    });

    // Results only available when vote is closed
    let results = null;
    if (vote.status === "CLOSED") {
      results = await calculateResults(id);
    }

    return NextResponse.json({
      id: vote.id,
      title: vote.title,
      description: vote.description,
      voteType: vote.voteType,
      status: vote.status,
      isSecret: vote.isSecret,
      quorumRequired: Number(vote.quorumRequired),
      deadline: vote.deadline,
      meetingId: vote.meetingId,
      createdBy: vote.createdBy,
      options: vote.options.map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
      ballotCount: vote._count.ballots,
      quorum: {
        current: quorum.currentQuorum,
        required: Number(vote.quorumRequired),
        totalBallotWeight: quorum.totalBallotWeight,
        totalOwnershipShares: quorum.totalOwnershipShares,
      },
      myBallot: myBallot
        ? { optionId: myBallot.optionId, receiptHash: myBallot.receiptHash }
        : null,
      myWeight: unit ? Number(unit.ownershipShare) : 0,
      results,
      createdAt: vote.createdAt,
      updatedAt: vote.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch vote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.vote.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;

    const updated = await prisma.vote.update({
      where: { id },
      data,
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      entityType: "Vote",
      entityId: id,
      action: "UPDATE",
      userId: user.id,
      oldValue: { status: existing.status },
      newValue: data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update vote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
