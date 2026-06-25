import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import {
  awardBid,
  findTicketForAwardRoute,
  findContractorOrgWithOwner,
  findLoserBidsForEmail,
  bidWasAwarded,
  bidWasRejected,
} from "@/lib/marketplace";
import { sendEmail } from "@/lib/email";
import { bidWonEmail, bidRejectedEmail } from "@/lib/email-templates";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; bidId: string }>;
}

/**
 * POST /api/maintenance/tickets/[id]/bids/[bidId]/award
 *
 * Awards one bid. Triggers the cascading status flip + best-effort
 * winner + loser emails. The winner gets the conditionally-revealed
 * private fields (address/unit/owner phone) gated by the publication's
 * privacy toggles.
 */
export async function POST(_request: Request, ctx: RouteContext) {
  let userBlock;
  try {
    userBlock = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinimumRole(userBlock.role, "BOARD_MEMBER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId, bidId } = await ctx.params;
  const ticket = await findTicketForAwardRoute(ticketId);
  if (!ticket || ticket.buildingId !== userBlock.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ticket.publication) {
    return NextResponse.json({ error: "Not published" }, { status: 404 });
  }

  let outcome;
  try {
    outcome = await awardBid(bidId, userBlock.userId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Award failed" },
      { status: 400 },
    );
  }

  // Audit + winner notification — domain event.
  await bidWasAwarded({
    publicationId: outcome.publicationId,
    winningBidId: outcome.winningBidId,
    winnerOrgId: outcome.winnerOrgId,
    awardedByUserId: userBlock.userId,
    scrubbedTitle: ticket.publication.scrubbedTitle,
  });

  // Winner email still lives at the route (Phase F slimming will move
  // this into a service that composes the event + email together).
  const winner = await findContractorOrgWithOwner(outcome.winnerOrgId);
  const winnerOwner = winner?.users[0];
  if (winnerOwner) {
    const base =
      process.env.NEXTAUTH_URL ??
      process.env.BASE_URL ??
      "http://localhost:3000";
    const fullAddress = ticket.publication.revealAddressOnAward
      ? `${ticket.building.zipCode} ${ticket.building.city}, ${ticket.building.address}`
      : null;
    const unitNumber = ticket.publication.revealUnitOnAward
      ? ticket.location
      : null;
    // Owner phone is not modelled on MaintenanceTicket; we expose only
    // what's actually there (location text). Reveal toggle still
    // honoured — Phase 5 wires real owner phone via Unit/Resident.
    const ownerPhone = ticket.publication.revealOwnerPhoneOnAward
      ? null
      : null;

    const { subject, html } = bidWonEmail({
      recipientName: winnerOwner.name,
      publicationTitle: ticket.publication.scrubbedTitle,
      fullAddress,
      unitNumber,
      ownerPhone,
      boardContactEmail: ticket.publication.boardContactEmail,
      boardContactPhone: ticket.publication.boardContactPhone,
      projectsUrl: `${base}/hu/contractor/projects`,
      locale: "hu",
    });
    sendEmail(winnerOwner.email, subject, html).catch((err) =>
      console.error("Winner email failed:", err),
    );
  }

  // ── Loser emails + notifications ────────────────────────────────
  if (outcome.rejectedBidIds.length > 0) {
    const losers = await findLoserBidsForEmail(outcome.rejectedBidIds);
    const base =
      process.env.NEXTAUTH_URL ??
      process.env.BASE_URL ??
      "http://localhost:3000";
    for (const l of losers) {
      const recipient = l.bidder.users[0];
      if (!recipient) continue;
      const { subject, html } = bidRejectedEmail({
        recipientName: recipient.name,
        publicationTitle: ticket.publication.scrubbedTitle,
        reason:
          l.decisionReason ?? "Másik ajánlat lett kiválasztva",
        marketplaceUrl: `${base}/hu/contractor/marketplace`,
        locale: "hu",
      });
      sendEmail(recipient.email, subject, html).catch((err) =>
        console.error("Loser email failed:", err),
      );
      await bidWasRejected({
        publicationId: ticket.publication.id,
        contractorUserId: recipient.id,
        scrubbedTitle: ticket.publication.scrubbedTitle,
        reason: l.decisionReason ?? "Másik ajánlat lett kiválasztva.",
      });
    }
  }

  return NextResponse.json({ ok: true, outcome });
}
