import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { publishToMeeting } from "@/lib/assembly-bus";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";
import { ballotCast } from "@/lib/voting/events";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    const limited = await rateLimitMutationOrRespond(userId, "ballot:cast", {
      limit: 10,
      windowSeconds: 60,
    });
    if (limited) return limited;

    try {
      await requireFeature(buildingId, "voting");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id: voteId } = await context.params;
    const body = await request.json();
    const { optionId, proxyForUnitId, onBehalfOfUnitId } = body;

    if (!optionId) {
      return NextResponse.json(
        { error: "Missing required field: optionId" },
        { status: 400 }
      );
    }

    // Fetch the vote and verify building scope
    const vote = await prisma.vote.findUnique({
      where: { id: voteId },
      include: { options: true },
    });

    if (!vote || vote.buildingId !== buildingId) {
      return NextResponse.json({ error: "Vote not found" }, { status: 404 });
    }

    if (vote.status !== "OPEN") {
      return NextResponse.json({ error: "Vote is not open" }, { status: 400 });
    }

    if (new Date() > vote.deadline) {
      return NextResponse.json({ error: "Vote deadline has passed" }, { status: 400 });
    }

    // Validate option belongs to this vote
    const validOption = vote.options.find((o) => o.id === optionId);
    if (!validOption) {
      return NextResponse.json({ error: "Invalid option for this vote" }, { status: 400 });
    }

    let castById: string | null = null;
    // Units this request will cast for. Self-voting fans out across ALL of the
    // owner's units (one ballot each, same option) so their full ownership
    // weight counts; proxy / on-behalf target a single unit.
    let targets: { unitId: string; ballotUserId: string | null }[] = [];

    if (onBehalfOfUnitId) {
      // "Cast on behalf" — organizer/board member votes for another unit.
      if (!allows(ctx, "vote.cast")) {
        return NextResponse.json(
          { error: "Only board members can cast votes on behalf of others" },
          { status: 403 }
        );
      }
      const unit = await prisma.unit.findFirst({
        where: { id: onBehalfOfUnitId, buildingId },
        select: { id: true },
      });
      if (!unit) {
        return NextResponse.json({ error: "Unit not found in this building" }, { status: 404 });
      }
      castById = userId;
      const unitOwner = await prisma.unitUser.findFirst({
        where: { unitId: onBehalfOfUnitId, isPrimaryContact: true },
        select: { userId: true },
      });
      targets = [{ unitId: onBehalfOfUnitId, ballotUserId: vote.isSecret ? null : unitOwner?.userId ?? null }];
    } else if (proxyForUnitId) {
      // Proxy voting — grantee casts for the grantor's unit.
      const userUnit = await prisma.unitUser.findFirst({
        where: { userId, unit: { buildingId } },
        select: { unitId: true },
      });
      if (!userUnit) {
        return NextResponse.json({ error: "No unit found in this building" }, { status: 400 });
      }
      const now = new Date();
      const proxy = await prisma.proxyAssignment.findFirst({
        where: {
          granteeId: userId,
          grantor: { unitUsers: { some: { unitId: proxyForUnitId } } },
          validFrom: { lte: now },
          AND: [
            { OR: [{ voteId: voteId }, { voteId: null }] },
            { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
          ],
        },
      });
      if (!proxy) {
        return NextResponse.json({ error: "No valid proxy assignment found" }, { status: 403 });
      }
      targets = [{ unitId: proxyForUnitId, ballotUserId: vote.isSecret ? null : userId }];
    } else {
      // Self-voting — only owners may cast (Tht. § 38); tenants are excluded.
      if (!allows(ctx, "vote.cast")) {
        return NextResponse.json({ error: "Only owners can cast a vote" }, { status: 403 });
      }
      const ownerUnits = await prisma.unitUser.findMany({
        where: { userId, relationship: "OWNER", unit: { buildingId } },
        select: { unitId: true },
      });
      if (ownerUnits.length === 0) {
        return NextResponse.json({ error: "No unit found in this building" }, { status: 400 });
      }
      let unitIds = ownerUnits.map((u) => u.unitId);

      // Presence gate: for a vote inside a meeting, only checked-in units may
      // vote (the companion self-checks-in on joining; the board uses
      // "Érkeztetés"). Cast for the present subset; reject if none are present.
      if (vote.meetingId) {
        const present = await prisma.meetingAttendance.findMany({
          where: {
            meetingId: vote.meetingId,
            unitId: { in: unitIds },
            checkedIn: true,
            checkedOutAt: null,
          },
          select: { unitId: true },
        });
        const presentSet = new Set(present.map((p) => p.unitId));
        unitIds = unitIds.filter((id) => presentSet.has(id));
        if (unitIds.length === 0) {
          return NextResponse.json({ error: "NOT_CHECKED_IN" }, { status: 403 });
        }
      }
      targets = unitIds.map((id) => ({ unitId: id, ballotUserId: vote.isSecret ? null : userId }));
    }

    // Skip units that already voted; 409 only if none remain.
    const already = await prisma.ballot.findMany({
      where: { voteId, unitId: { in: targets.map((t) => t.unitId) } },
      select: { unitId: true },
    });
    const votedSet = new Set(already.map((b) => b.unitId));
    const fresh = targets.filter((t) => !votedSet.has(t.unitId));
    if (fresh.length === 0) {
      return NextResponse.json(
        { error: "This unit has already cast a ballot for this vote" },
        { status: 409 }
      );
    }

    const units = await prisma.unit.findMany({
      where: { id: { in: fresh.map((t) => t.unitId) } },
      select: { id: true, ownershipShare: true },
    });
    const shareById = new Map(units.map((u) => [u.id, u.ownershipShare]));

    let secret: string | null = null;
    if (vote.isSecret) {
      secret = process.env.BALLOT_SECRET ?? null;
      if (!secret) {
        return NextResponse.json(
          { error: "Voting system configuration error. Contact administrator." },
          { status: 500 }
        );
      }
    }

    // Fan out: one ballot per target unit (same option).
    const created: { id: string; unitId: string; weight: number; receiptHash: string | null }[] = [];
    for (const t of fresh) {
      const share = shareById.get(t.unitId);
      if (share === undefined) continue;
      const ballot = await prisma.ballot.create({
        data: { voteId, optionId, unitId: t.unitId, userId: t.ballotUserId, castById, weight: share, receiptHash: null },
      });
      let receiptHash: string | null = null;
      if (secret) {
        receiptHash = createHash("sha256").update(ballot.id + secret).digest("hex");
        await prisma.ballot.update({ where: { id: ballot.id }, data: { receiptHash } });
      }
      created.push({ id: ballot.id, unitId: t.unitId, weight: Number(share), receiptHash });
    }

    await ballotCast({
      ballotId: created[0].id,
      voterUserId: userId,
      buildingId,
      newValue: {
        voteId,
        unitIds: created.map((c) => c.unitId),
        isProxy: !!proxyForUnitId,
        isOnBehalf: !!onBehalfOfUnitId,
        isSecret: vote.isSecret,
      },
    });

    // Live assembly: nudge the presenter's tally to refresh.
    if (vote.meetingId) {
      publishToMeeting(vote.meetingId, {
        type: "session:tally",
        meetingId: vote.meetingId,
        voteId,
      });
    }

    return NextResponse.json(
      {
        // Back-compat single-ballot fields (first/only unit) + aggregate.
        id: created[0].id,
        voteId,
        optionId,
        weight: created.reduce((s, c) => s + c.weight, 0),
        receiptHash: created[0].receiptHash,
        castOnBehalf: !!castById,
        ballots: created,
        count: created.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to cast ballot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
