import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { calculateQuorum, calculateResults, calculateMeetingQuorum, calculateVoteResult } from "@/lib/voting/quorum";
import { voteUpdated } from "@/lib/voting/events";
import { resolveAwardVote } from "@/lib/marketplace";
import { publishToMeeting } from "@/lib/assembly-bus";

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

    // The caller's own units in this building (only owners vote — Tht. §38).
    // myWeight is the SUM across all owned units; a single cast fans out to each.
    const ownerUnits = await prisma.unitUser.findMany({
      where: { userId, relationship: "OWNER", unit: { buildingId } },
      select: { unit: { select: { id: true, ownershipShare: true } } },
    });
    const myWeight = ownerUnits.reduce((sum, u) => sum + Number(u.unit.ownershipShare), 0);
    const ownerUnitIds = ownerUnits.map((u) => u.unit.id);

    // Whether the caller's units have voted (any of them) + which option.
    const myBallot = ownerUnitIds.length
      ? await prisma.ballot.findFirst({
          where: { voteId: id, unitId: { in: ownerUnitIds } },
          select: { optionId: true, receiptHash: true },
        })
      : null;

    // Units the caller may cast for via an active proxy (meghatalmazás) —
    // the grantor's owner-units in this building, for proxies valid now and
    // in scope for this vote. Each carries whether it has already voted.
    const now = new Date();
    const proxyAssignments = await prisma.proxyAssignment.findMany({
      where: {
        granteeId: userId,
        validFrom: { lte: now },
        AND: [
          { OR: [{ voteId: id }, { voteId: null }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      select: {
        grantorId: true,
        grantor: {
          select: {
            name: true,
            unitUsers: {
              where: { relationship: "OWNER", unit: { buildingId } },
              select: { unit: { select: { id: true, number: true, ownershipShare: true } } },
            },
          },
        },
      },
    });

    const proxyUnitMap = new Map<
      string,
      { unitId: string; unitNumber: string; grantorId: string; grantorName: string; weight: number }
    >();
    for (const pa of proxyAssignments) {
      for (const uu of pa.grantor.unitUsers) {
        if (!proxyUnitMap.has(uu.unit.id)) {
          proxyUnitMap.set(uu.unit.id, {
            unitId: uu.unit.id,
            unitNumber: uu.unit.number,
            grantorId: pa.grantorId,
            grantorName: pa.grantor.name,
            weight: Number(uu.unit.ownershipShare),
          });
        }
      }
    }
    const proxyUnitIds = [...proxyUnitMap.keys()];
    const proxyBallots = proxyUnitIds.length
      ? await prisma.ballot.findMany({
          where: { voteId: id, unitId: { in: proxyUnitIds } },
          select: { unitId: true, optionId: true },
        })
      : [];
    const proxyVotedBy = new Map(proxyBallots.map((b) => [b.unitId, b.optionId]));
    const proxyUnits = [...proxyUnitMap.values()].map((u) => ({
      ...u,
      votedOptionId: proxyVotedBy.get(u.unitId) ?? null,
    }));

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
      myWeight,
      proxyUnits,
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

    // Auto-award: if a contractor-award vote just closed, tally it and
    // award the winning bid (or unfreeze the publication on no-quorum /
    // "none"). Best-effort — a failure here must not fail the close.
    let award: Awaited<ReturnType<typeof resolveAwardVote>> | null = null;
    if (
      data.status === "CLOSED" &&
      existing.status !== "CLOSED" &&
      existing.linkedPublicationId
    ) {
      try {
        award = await resolveAwardVote(id, userId);
      } catch (err) {
        console.error("Auto-award on vote close failed:", err);
      }
    }

    // Live assembly: when a meeting-linked vote closes, clear it as the
    // current vote and broadcast so presenter + companions update.
    if (data.status === "CLOSED" && existing.status !== "CLOSED" && existing.meetingId) {
      await prisma.meeting.updateMany({
        where: { id: existing.meetingId, currentVoteId: id },
        data: { currentVoteId: null },
      });
      publishToMeeting(existing.meetingId, {
        type: "session:voteClosed",
        meetingId: existing.meetingId,
        voteId: id,
      });
    }

    return NextResponse.json({ ...updated, award });
  } catch (error) {
    console.error("Failed to update vote:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
