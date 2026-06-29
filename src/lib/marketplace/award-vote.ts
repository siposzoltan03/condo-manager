import { prisma } from "@/lib/prisma";
import { votingQueue } from "@/lib/queue";
import { awardBid } from "./bidding";
import { dispatchAwardOutcome } from "./award-notify";

/**
 * Voting-based award: instead of the board picking a winning bid directly,
 * the bids become the options of a közgyűlés (general-assembly) vote. The
 * winning bid is awarded automatically when that vote closes.
 *
 * This service bridges the marketplace and voting domains, so — unlike the
 * rest of the marketplace which goes through `./dal` — it talks to Prisma
 * directly (both models live behind the same client).
 */

/** Owners holding ≥ this fraction of total shares must vote for the
 *  result to be határozatképes (decisive). Below it → no award. */
export const AWARD_VOTE_QUORUM = 0.5;

export type CreateAwardVoteResult =
  | { ok: true; voteId: string }
  | {
      ok: false;
      reason:
        | "PUBLICATION_NOT_FOUND"
        | "NOT_OPEN"
        | "NO_BIDS"
        | "MEETING_NOT_FOUND";
    };

/**
 * Put a publication's open bids to a vote at an existing meeting. Creates a
 * MULTIPLE_CHOICE / PLURALITY vote (one option per SUBMITTED bid + an
 * "Egyik sem" none-option), freezes the publication (PENDING_VOTE, which
 * blocks further bids), and appends an agenda point to the meeting.
 */
export async function createAwardVote(input: {
  publicationId: string;
  meetingId: string;
  buildingId: string;
  createdByUserId: string;
}): Promise<CreateAwardVoteResult> {
  const result = await prisma.$transaction(async (tx) => {
    const pub = await tx.marketplacePublication.findUnique({
      where: { id: input.publicationId },
      include: {
        ticket: { select: { id: true, title: true, buildingId: true } },
        bids: {
          where: { status: "SUBMITTED" },
          include: { bidder: { select: { name: true } } },
        },
      },
    });
    if (!pub || pub.ticket.buildingId !== input.buildingId) {
      return { ok: false as const, reason: "PUBLICATION_NOT_FOUND" as const };
    }
    if (pub.status !== "OPEN") {
      return { ok: false as const, reason: "NOT_OPEN" as const };
    }
    if (pub.bids.length < 1) {
      return { ok: false as const, reason: "NO_BIDS" as const };
    }

    const meeting = await tx.meeting.findUnique({
      where: { id: input.meetingId },
      select: { id: true, buildingId: true, date: true, agenda: true },
    });
    if (!meeting || meeting.buildingId !== input.buildingId) {
      return { ok: false as const, reason: "MEETING_NOT_FOUND" as const };
    }

    // Cheapest bid first — stable, readable option order.
    const sorted = [...pub.bids].sort(
      (a, b) => Number(a.amount) - Number(b.amount),
    );

    const title = `Kivitelező kiválasztása — ${pub.ticket.title}`;
    const agendaSub = `${pub.bids.length} beérkezett ajánlat · tulajdoni hányad szerinti szavazás`;

    const vote = await tx.vote.create({
      data: {
        title,
        description: pub.scrubbedTitle,
        voteType: "MULTIPLE_CHOICE",
        status: "OPEN",
        isSecret: false,
        majorityType: "PLURALITY",
        quorumRequired: AWARD_VOTE_QUORUM,
        deadline: meeting.date,
        buildingId: input.buildingId,
        meetingId: meeting.id,
        createdById: input.createdByUserId,
        linkedPublicationId: pub.id,
        options: {
          create: [
            ...sorted.map((b, i) => ({
              label: b.bidder.name,
              sortOrder: i,
              bidId: b.id,
            })),
            { label: "Egyik sem", sortOrder: sorted.length, bidId: null },
          ],
        },
      },
    });

    // Freeze the publication: no further bids while it's at vote.
    await tx.marketplacePublication.update({
      where: { id: pub.id },
      data: { status: "PENDING_VOTE" },
    });

    // Append the bid-vote agenda point (kind tags it for the meeting UI).
    const agenda = Array.isArray(meeting.agenda) ? meeting.agenda : [];
    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        agenda: [
          ...(agenda as unknown[]),
          { kind: "award_vote", voteId: vote.id, title, description: agendaSub },
        ] as object[] as never,
      },
    });

    return { ok: true as const, voteId: vote.id, deadline: meeting.date };
  });

  if (result.ok) {
    // Schedule the deadline auto-close (+ auto-award) the same way the votes
    // route does, so award votes close at the deadline even with no manual
    // close. Best-effort — the votes-close cron is the safety net if this fails.
    try {
      const delay = Math.max(0, result.deadline.getTime() - Date.now());
      await votingQueue.add(
        "vote-auto-close",
        { voteId: result.voteId },
        { delay, jobId: `vote-close-${result.voteId}` },
      );
    } catch (err) {
      console.error("Failed to schedule award-vote auto-close:", err);
    }
    return { ok: true, voteId: result.voteId };
  }
  return result;
}

export type ResolveAwardVoteResult =
  | { awarded: true; bidId: string }
  | { awarded: false; reason: "NOT_AWARD_VOTE" | "NO_QUORUM" | "NONE" };

/**
 * Called when a contractor-award vote closes. Tallies the share-weighted
 * ballots; if the vote is határozatképes (participation ≥ quorum) and a
 * real bid (not "Egyik sem") won the plurality, awards it automatically and
 * fires the winner/loser emails. Otherwise unfreezes the publication
 * (PENDING_VOTE → OPEN) so the board can re-decide.
 */
export async function resolveAwardVote(
  voteId: string,
  closedByUserId: string,
): Promise<ResolveAwardVoteResult> {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    include: {
      options: { include: { ballots: { select: { weight: true } } } },
      building: { include: { units: { select: { ownershipShare: true } } } },
    },
  });
  if (!vote || !vote.linkedPublicationId) {
    return { awarded: false, reason: "NOT_AWARD_VOTE" };
  }
  const publicationId = vote.linkedPublicationId;

  const totalShares = vote.building.units.reduce(
    (s, u) => s + Number(u.ownershipShare),
    0,
  );
  const weights = vote.options.map((o) => ({
    bidId: o.bidId,
    weight: o.ballots.reduce((s, b) => s + Number(b.weight), 0),
  }));
  const castWeight = weights.reduce((s, o) => s + o.weight, 0);

  const unfreeze = () =>
    prisma.marketplacePublication.update({
      where: { id: publicationId },
      data: { status: "OPEN" },
    });

  // Határozatképesség: enough ownership share participated?
  if (totalShares <= 0 || castWeight / totalShares < AWARD_VOTE_QUORUM) {
    await unfreeze();
    return { awarded: false, reason: "NO_QUORUM" };
  }

  const winner = [...weights].sort((a, b) => b.weight - a.weight)[0];
  if (!winner || winner.weight <= 0 || !winner.bidId) {
    // "Egyik sem" won, or no real votes — no award.
    await unfreeze();
    return { awarded: false, reason: "NONE" };
  }

  const outcome = await awardBid(winner.bidId, closedByUserId);
  await dispatchAwardOutcome(outcome, closedByUserId);
  return { awarded: true, bidId: winner.bidId };
}
