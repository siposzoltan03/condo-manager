import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { voteUpdated } from "@/lib/voting/events";
import { resolveAwardVote } from "@/lib/marketplace";

export const runtime = "nodejs";

/**
 * Cron tick: close every OPEN vote whose deadline has passed, and for
 * contractor-award votes (linkedPublicationId set) run the auto-award —
 * so the winning bid is awarded even if no board member manually closes
 * the vote.
 *
 * Auth: Bearer CRON_SECRET. Run a few times a day from the system cron /
 * Vercel Cron (mirror the camera-retention + maintenance-scheduled crons).
 * Idempotent: only OPEN votes past deadline are touched.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runTick();
}

/** Allow POST too — some schedulers prefer POST with an empty body. */
export async function POST(request: NextRequest) {
  return GET(request);
}

async function runTick(): Promise<NextResponse> {
  const now = new Date();
  const expired = await prisma.vote.findMany({
    where: { status: "OPEN", deadline: { lt: now } },
    select: {
      id: true,
      buildingId: true,
      createdById: true,
      linkedPublicationId: true,
    },
  });

  const closed: string[] = [];
  const awarded: Array<{ voteId: string; result: unknown }> = [];
  const errors: Array<{ voteId: string; error: string }> = [];

  for (const v of expired) {
    await prisma.vote.update({
      where: { id: v.id },
      data: { status: "CLOSED" },
    });
    // Audit the close under the vote's initiator (no human actor at cron time).
    await voteUpdated({
      voteId: v.id,
      updatedByUserId: v.createdById,
      buildingId: v.buildingId,
      oldStatus: "OPEN",
      newValue: { status: "CLOSED", closedBy: "cron" },
    });
    closed.push(v.id);

    if (v.linkedPublicationId) {
      try {
        const result = await resolveAwardVote(v.id, v.createdById);
        awarded.push({ voteId: v.id, result });
      } catch (err) {
        // A single award failure must not abort the rest of the tick.
        console.error(`Auto-award on cron close failed for ${v.id}:`, err);
        errors.push({ voteId: v.id, error: String(err) });
      }
    }
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    closedCount: closed.length,
    awardedCount: awarded.length,
    awarded,
    errors,
  });
}
