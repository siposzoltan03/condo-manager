import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { rateLimitMutationOrRespond } from "@/lib/rate-limit";
import { ballotCast } from "@/lib/voting/events";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
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

    let unitId: string;
    let castById: string | null = null;
    let ballotUserId: string | null = vote.isSecret ? null : userId;

    if (onBehalfOfUnitId) {
      // "Cast on behalf" — organizer/board member votes for another unit
      const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
      if (!isBoardPlus) {
        return NextResponse.json(
          { error: "Only board members can cast votes on behalf of others" },
          { status: 403 }
        );
      }

      // Verify the unit belongs to this building
      const unit = await prisma.unit.findFirst({
        where: { id: onBehalfOfUnitId, buildingId },
      });
      if (!unit) {
        return NextResponse.json({ error: "Unit not found in this building" }, { status: 404 });
      }

      unitId = onBehalfOfUnitId;
      castById = userId;

      // Find the unit owner for ballot attribution
      const unitOwner = await prisma.unitUser.findFirst({
        where: { unitId: onBehalfOfUnitId, isPrimaryContact: true },
        select: { userId: true },
      });
      ballotUserId = vote.isSecret ? null : (unitOwner?.userId ?? null);

    } else if (proxyForUnitId) {
      // Proxy voting — existing logic
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
          grantor: {
            unitUsers: { some: { unitId: proxyForUnitId } },
          },
          validFrom: { lte: now },
          AND: [
            {
              OR: [
                { voteId: voteId },
                { voteId: null },
              ],
            },
            {
              OR: [
                { validUntil: null },
                { validUntil: { gte: now } },
              ],
            },
          ],
        },
      });

      if (!proxy) {
        return NextResponse.json(
          { error: "No valid proxy assignment found" },
          { status: 403 }
        );
      }

      unitId = proxyForUnitId;
    } else {
      // Self-voting
      const userUnit = await prisma.unitUser.findFirst({
        where: { userId, unit: { buildingId } },
        select: { unitId: true },
      });
      if (!userUnit) {
        return NextResponse.json({ error: "No unit found in this building" }, { status: 400 });
      }
      unitId = userUnit.unitId;
    }

    // Check if this unit already voted
    const existingBallot = await prisma.ballot.findUnique({
      where: { voteId_unitId: { voteId, unitId } },
    });

    if (existingBallot) {
      return NextResponse.json(
        { error: "This unit has already cast a ballot for this vote" },
        { status: 409 }
      );
    }

    // Get unit's ownership share for weight
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { ownershipShare: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Create ballot
    const ballot = await prisma.ballot.create({
      data: {
        voteId,
        optionId,
        unitId,
        userId: ballotUserId,
        castById,
        weight: unit.ownershipShare,
        receiptHash: null,
      },
    });

    let receiptHash: string | null = null;

    if (vote.isSecret) {
      const secret = process.env.BALLOT_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: "Voting system configuration error. Contact administrator." },
          { status: 500 }
        );
      }
      receiptHash = createHash("sha256")
        .update(ballot.id + secret)
        .digest("hex");

      await prisma.ballot.update({
        where: { id: ballot.id },
        data: { receiptHash },
      });
    }

    await ballotCast({
      ballotId: ballot.id,
      voterUserId: userId,
      buildingId,
      newValue: {
        voteId,
        unitId,
        isProxy: !!proxyForUnitId,
        isOnBehalf: !!onBehalfOfUnitId,
        isSecret: vote.isSecret,
      },
    });

    return NextResponse.json({
      id: ballot.id,
      voteId: ballot.voteId,
      optionId: ballot.optionId,
      weight: Number(ballot.weight),
      receiptHash,
      castOnBehalf: !!castById,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to cast ballot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
