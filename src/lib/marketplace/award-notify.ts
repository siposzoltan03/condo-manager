import { sendEmail } from "@/lib/email";
import { bidWonEmail, bidRejectedEmail } from "@/lib/email-templates";
import type { AwardOutcome } from "./bidding";
import {
  findTicketForAwardRoute,
  findContractorOrgWithOwner,
  findLoserBidsForEmail,
} from "./dal";
import { bidWasAwarded, bidWasRejected } from "./events";

const REJECTION_FALLBACK = "Másik ajánlat lett kiválasztva";

function baseUrl() {
  return (
    process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? "http://localhost:3000"
  );
}

/**
 * Post-award orchestration shared by the manual award route and the
 * vote-driven auto-award hook: emits the audit/notification domain events
 * and fires the winner + loser emails (best-effort). Re-loads the ticket
 * from the outcome so callers don't have to thread it through.
 *
 * Idempotent-safe: if the outcome rejected no bids (e.g. a re-award), only
 * the winner path runs.
 */
export async function dispatchAwardOutcome(
  outcome: AwardOutcome,
  awardedByUserId: string,
): Promise<void> {
  const ticket = await findTicketForAwardRoute(outcome.ticketId);
  if (!ticket?.publication) return;
  const pub = ticket.publication;

  await bidWasAwarded({
    publicationId: outcome.publicationId,
    winningBidId: outcome.winningBidId,
    winnerOrgId: outcome.winnerOrgId,
    awardedByUserId,
    scrubbedTitle: pub.scrubbedTitle,
  });

  // ── Winner email (conditionally-revealed private fields) ──────────
  const winner = await findContractorOrgWithOwner(outcome.winnerOrgId);
  const winnerOwner = winner?.users[0];
  if (winnerOwner) {
    const fullAddress = pub.revealAddressOnAward
      ? `${ticket.building.zipCode} ${ticket.building.city}, ${ticket.building.address}`
      : null;
    const unitNumber = pub.revealUnitOnAward ? ticket.location : null;
    // Owner phone isn't modelled on MaintenanceTicket yet; honour the
    // toggle but expose nothing (parity with the manual award route).
    const ownerPhone = null;

    const { subject, html } = bidWonEmail({
      recipientName: winnerOwner.name,
      publicationTitle: pub.scrubbedTitle,
      fullAddress,
      unitNumber,
      ownerPhone,
      boardContactEmail: pub.boardContactEmail,
      boardContactPhone: pub.boardContactPhone,
      projectsUrl: `${baseUrl()}/hu/contractor/projects`,
      locale: "hu",
    });
    sendEmail(winnerOwner.email, subject, html).catch((err) =>
      console.error("Winner email failed:", err),
    );
  }

  // ── Loser emails + notifications (P2B Art. 4 reason) ──────────────
  if (outcome.rejectedBidIds.length > 0) {
    const losers = await findLoserBidsForEmail(outcome.rejectedBidIds);
    for (const l of losers) {
      const recipient = l.bidder.users[0];
      if (!recipient) continue;
      const { subject, html } = bidRejectedEmail({
        recipientName: recipient.name,
        publicationTitle: pub.scrubbedTitle,
        reason: l.decisionReason ?? REJECTION_FALLBACK,
        marketplaceUrl: `${baseUrl()}/hu/contractor/marketplace`,
        locale: "hu",
      });
      sendEmail(recipient.email, subject, html).catch((err) =>
        console.error("Loser email failed:", err),
      );
      await bidWasRejected({
        publicationId: pub.id,
        contractorUserId: recipient.id,
        scrubbedTitle: pub.scrubbedTitle,
        reason: l.decisionReason ?? `${REJECTION_FALLBACK}.`,
      });
    }
  }
}
