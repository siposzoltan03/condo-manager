import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { calculateQuorum, calculateResults, calculateMeetingQuorum, calculateVoteResult } from "@/lib/voting/quorum";
import { voteUpdated } from "@/lib/voting/events";

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
        ballots: {
          select: {
            id: true,
            unitId: true,
            optionId: true,
            castById: true,
            weight: true,
          },
        },
        _count: { select: { ballots: true } },
      },
    });

    if (!vote || vote.buildingId !== buildingId) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    // Meeting quorum (attendance-based) if vote is linked to a meeting
    const meetingQuorum = vote.meetingId
      ? await calculateMeetingQuorum(vote.meetingId)
      : null;

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
      results = await calculateVoteResult(id);
    }

    return NextResponse.json({
      id: vote.id,
      title: vote.title,
      description: vote.description,
      voteType: vote.voteType,
      status: vote.status,
      isSecret: vote.isSecret,
      majorityType: vote.majorityType,
      quorumRequired: Number(vote.quorumRequired), // @deprecated
      deadline: vote.deadline,
      meetingId: vote.meetingId,
      createdBy: vote.createdBy,
      options: vote.options.map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
      ballotCount: vote._count.ballots,
      meetingQuorum,
      myBallot: myBallot
        ? { optionId: myBallot.optionId, receiptHash: myBallot.receiptHash }
        : null,
      myWeight: unit ? Number(unit.ownershipShare) : 0,
      results,
      ballots: vote.ballots.map((b) => ({
        id: b.id,
        unitId: b.unitId,
        optionId: b.optionId,
        castById: b.castById,
        weight: Number(b.weight),
      })),
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
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!allows(ctx, "vote.start")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.vote.findUnique({
      where: { id },
    });
    if (!existing || existing.buildingId !== buildingId) {
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

    await voteUpdated({
      voteId: id,
      updatedByUserId: userId,
      buildingId,
      oldStatus: existing.status,
      newValue: data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update vote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
