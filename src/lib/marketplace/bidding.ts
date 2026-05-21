import type { SpecialtySlug } from "@/lib/contractor/taxonomy";
import * as dal from "./dal";
import { getEffectivePlan, isWithinBidThroughput } from "./pricing";

/**
 * Marketplace bidding service. The contractor side never reads
 * `MaintenanceTicket` directly — only `MarketplacePublication`. Once a
 * bid is awarded, `ticket.awardedContractorId` is set and the existing
 * condo-side maintenance flow takes over.
 *
 * Throughput quota is plan-based (Free = 3 / 7 days; Pro + Premium
 * unlimited). See `src/lib/marketplace/pricing.ts`.
 */

export interface SubmitBidInput {
  publicationId: string;
  bidderOrgId: string;
  amount: number;
  etaDays: number;
  notes: string | null;
}

export type SubmitBidResult =
  | { ok: true; bidId: string; updated: boolean }
  | { ok: false; reason: SubmitBidError };

export type SubmitBidError =
  | "NOT_OPEN"
  | "ORG_NOT_ACTIVE"
  | "SPECIALTY_MISMATCH"
  | "QUOTA_EXCEEDED"
  | "INVALID_AMOUNT"
  | "INVALID_ETA"
  | "PUBLICATION_NOT_FOUND";

export async function createOrUpdateBid(
  input: SubmitBidInput,
): Promise<SubmitBidResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  if (!Number.isInteger(input.etaDays) || input.etaDays < 1 || input.etaDays > 365) {
    return { ok: false, reason: "INVALID_ETA" };
  }

  const [pub, org] = await Promise.all([
    dal.findPublicationForBidding(input.publicationId),
    dal.findOrgForBiddingPolicy(input.bidderOrgId),
  ]);
  if (!pub) return { ok: false, reason: "PUBLICATION_NOT_FOUND" };
  if (pub.status !== "OPEN") return { ok: false, reason: "NOT_OPEN" };
  if (!org || org.status !== "ACTIVE") {
    return { ok: false, reason: "ORG_NOT_ACTIVE" };
  }

  const pubSpecs = Array.isArray(pub.specialties)
    ? (pub.specialties as SpecialtySlug[])
    : [];
  const orgSpecs = Array.isArray(org.specialties)
    ? (org.specialties as SpecialtySlug[])
    : [];
  if (!pubSpecs.some((s) => orgSpecs.includes(s))) {
    return { ok: false, reason: "SPECIALTY_MISMATCH" };
  }

  const existing = await dal.findBidByPubAndOrg(pub.id, org.id);

  if (existing && existing.status !== "SUBMITTED") {
    // Once decided, no further edits.
    return { ok: false, reason: "NOT_OPEN" };
  }

  if (!existing) {
    const effective = await getEffectivePlan(org.id);
    if (!(await isWithinBidThroughput(org.id, effective))) {
      return { ok: false, reason: "QUOTA_EXCEEDED" };
    }
  }

  if (existing) {
    await dal.updateBid(existing.id, {
      amount: input.amount,
      etaDays: input.etaDays,
      notes: input.notes,
    });
    return { ok: true, bidId: existing.id, updated: true };
  }

  const created = await dal.createBid({
    publicationId: pub.id,
    bidderId: org.id,
    amount: input.amount,
    etaDays: input.etaDays,
    notes: input.notes,
  });
  return { ok: true, bidId: created.id, updated: false };
}

export async function getBidByContractor(
  publicationId: string,
  orgId: string,
) {
  return dal.getBidByContractor(publicationId, orgId);
}

/**
 * Board-side: bid summary for the review page. Joins the contractor
 * org info that the board is allowed to see — name + plan + counts.
 */
export async function getBidsForPublication(publicationId: string) {
  return dal.getBidsForPublication(publicationId);
}

export interface AwardOutcome {
  publicationId: string;
  ticketId: string;
  winningBidId: string;
  winnerOrgId: string;
  /** Bid ids that were rejected as a side-effect of awarding. */
  rejectedBidIds: string[];
}

/**
 * Award one bid. All other SUBMITTED bids on the same publication are
 * auto-rejected with the standard P2B reason. Caller is responsible for
 * sending emails (winner + losers) — this fn just mutates state.
 *
 * Idempotent: re-awarding a publication that's already AWARDED is a
 * no-op and returns the existing winner.
 */
export async function awardBid(
  bidId: string,
  decidedByUserId: string,
): Promise<AwardOutcome> {
  return dal.runTransaction(async (tx) => {
    const bid = await dal.findBidForAward(tx, bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.publication.status === "AWARDED") {
      const existing = await dal.findExistingAwardedBidId(tx, bid.publication.id);
      return {
        publicationId: bid.publication.id,
        ticketId: bid.publication.ticketId,
        winningBidId: existing?.awardedBidId ?? bid.id,
        winnerOrgId: bid.bidderId,
        rejectedBidIds: [],
      };
    }
    if (bid.publication.status !== "OPEN") {
      throw new Error("Publication is not OPEN");
    }
    if (bid.status !== "SUBMITTED") {
      throw new Error("Bid is not SUBMITTED");
    }

    const now = new Date();
    const REJECTION_REASON = "Másik ajánlat lett kiválasztva";

    await dal.markBidWon(tx, bid.id, now, decidedByUserId);

    const losers = await dal.findLosingBidIds(tx, bid.publication.id, bid.id);
    await dal.rejectLosingBids(
      tx,
      bid.publication.id,
      bid.id,
      REJECTION_REASON,
      now,
      decidedByUserId,
    );

    await dal.setPublicationAwarded(tx, bid.publication.id, bid.id, now);
    await dal.stampTicketAwardedContractor(
      tx,
      bid.publication.ticketId,
      bid.bidderId,
    );

    return {
      publicationId: bid.publication.id,
      ticketId: bid.publication.ticketId,
      winningBidId: bid.id,
      winnerOrgId: bid.bidderId,
      rejectedBidIds: losers.map((l) => l.id),
    };
  });
}
