import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    const { id: voteId } = await context.params;
    const body = await request.json();
    const { optionId, proxyForUnitId } = body;

    if (!optionId) {
      return NextResponse.json(
        { error: "Missing required field: optionId" },
        { status: 400 }
      );
    }

    // Fetch the vote and verify building scope
    const vote = await prisma.vote.findUnique({
      where: { id: voteId },
      include: { options: true, meeting: { select: { buildingId: true } } },
    });

    if (!vote || vote.meeting?.buildingId !== buildingId) {
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

    // Determine the unit casting the ballot
    const userUnit = await prisma.unitUser.findFirst({
      where: { userId, unit: { buildingId } },
      select: { unitId: true },
    });
    if (!userUnit) {
      return NextResponse.json({ error: "No unit found in this building" }, { status: 400 });
    }
    let unitId = userUnit.unitId;

    if (proxyForUnitId) {
      // Verify proxy assignment — find grantor via UnitUser
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
                { voteId: null }, // general proxy
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
    }

    // Check if this unit already voted (unique constraint)
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
        userId: vote.isSecret ? null : userId,
        weight: unit.ownershipShare,
        receiptHash: null, // will be set below for secret ballots
      },
    });

    let receiptHash: string | null = null;

    if (vote.isSecret) {
      // Generate receipt hash: SHA256(ballotId + secret)
      const secret = process.env.BALLOT_SECRET ?? "default-ballot-secret";
      receiptHash = createHash("sha256")
        .update(ballot.id + secret)
        .digest("hex");

      await prisma.ballot.update({
        where: { id: ballot.id },
        data: { receiptHash },
      });
    }

    await createAuditLog({
      entityType: "Ballot",
      entityId: ballot.id,
      action: "CREATE",
      userId,
      newValue: {
        voteId,
        unitId,
        isProxy: !!proxyForUnitId,
        isSecret: vote.isSecret,
      },
    });

    return NextResponse.json({
      id: ballot.id,
      voteId: ballot.voteId,
      optionId: ballot.optionId,
      weight: Number(ballot.weight),
      receiptHash,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to cast ballot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
