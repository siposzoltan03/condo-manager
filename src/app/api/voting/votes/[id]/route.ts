import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { calculateQuorum, calculateResults } from "@/lib/voting/quorum";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id } = await context.params;

    const vote = await prisma.vote.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
        meeting: { select: { buildingId: true } },
        _count: { select: { ballots: true } },
      },
    });

    if (!vote || vote.meeting?.buildingId !== buildingId) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    const quorum = await calculateQuorum(id);

    // Resolve user's unit in this building
    const userUnit = await prisma.unitUser.findFirst({
      where: { userId, unit: { buildingId } },
      select: { unitId: true },
    });

    // Check if user's unit already voted
    const myBallot = userUnit
      ? await prisma.ballot.findUnique({
          where: { voteId_unitId: { voteId: id, unitId: userUnit.unitId } },
          select: { optionId: true, receiptHash: true },
        })
      : null;

    // Get user's unit ownership share for display
    const unit = userUnit
      ? await prisma.unit.findUnique({
          where: { id: userUnit.unitId },
          select: { ownershipShare: true },
        })
      : null;

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
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.vote.findUnique({
      where: { id },
      include: { meeting: { select: { buildingId: true } } },
    });
    if (!existing || existing.meeting?.buildingId !== buildingId) {
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
      userId,
      oldValue: { status: existing.status },
      newValue: data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update vote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
