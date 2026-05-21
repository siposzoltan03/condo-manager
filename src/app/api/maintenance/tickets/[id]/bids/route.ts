import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { getBidsForPublication } from "@/lib/marketplace/bidding";
import { computeFitScores, WEIGHTS_VERSION } from "@/lib/marketplace/fit-scoring";
import { getTrustSummaries } from "@/lib/marketplace/trust";
import type { SpecialtySlug } from "@/lib/contractor/taxonomy";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/maintenance/tickets/[id]/bids
 *
 * Board-only. Lists bids on the ticket's marketplace publication
 * along with the bidder's display name + best-fit score + trust badges.
 */
export async function GET(_request: Request, ctx: RouteContext) {
  try {
  let userBlock;
  try {
    userBlock = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinimumRole(userBlock.role, "BOARD_MEMBER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId } = await ctx.params;
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: {
      buildingId: true,
      publication: {
        select: {
          id: true,
          status: true,
          scrubbedTitle: true,
          city: true,
          zip: true,
          urgency: true,
          specialties: true,
        },
      },
    },
  });
  if (!ticket || ticket.buildingId !== userBlock.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ticket.publication) {
    return NextResponse.json({ error: "Not published" }, { status: 404 });
  }

  const bids = await getBidsForPublication(ticket.publication.id);
  const orgIds = bids.map((b) => b.bidder.id);

  // Run ranker + trust in parallel — both stable on the same data set.
  const [fitScores, trust] = await Promise.all([
    computeFitScores(
      {
        id: ticket.publication.id,
        city: ticket.publication.city,
        zip: ticket.publication.zip,
        urgency: ticket.publication.urgency,
        specialties: Array.isArray(ticket.publication.specialties)
          ? (ticket.publication.specialties as SpecialtySlug[])
          : [],
      },
      bids.map((b) => ({
        id: b.id,
        amount: Number(b.amount),
        etaDays: b.etaDays,
        bidder: {
          id: b.bidder.id,
          navConfirmedAt: b.bidder.navConfirmedAt,
        },
      })),
    ),
    getTrustSummaries(orgIds, ticket.publication.city),
  ]);

  const fitByBid = new Map(fitScores.map((f) => [f.bidId, f]));

  return NextResponse.json({
    publication: ticket.publication,
    weightsVersion: WEIGHTS_VERSION,
    bids: bids.map((b) => {
      const fit = fitByBid.get(b.id);
      const t = trust[b.bidder.id];
      return {
        id: b.id,
        amount: Number(b.amount),
        etaDays: b.etaDays,
        notes: b.notes,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        bidder: {
          id: b.bidder.id,
          name: b.bidder.name,
          plan: b.bidder.plan,
          navConfirmed: !!b.bidder.navConfirmedAt,
          awardedCount: b.bidder._count.awardedTickets,
          avgRating: t?.avgRating ?? null,
          ratingCount: t?.ratingCount ?? 0,
          badges: t?.badges ?? [],
        },
        fit: fit
          ? {
              score: fit.score,
              rationale: fit.rationale,
              weightsVersion: fit.weightsVersion,
            }
          : null,
      };
    }),
  });
  } catch (err) {
    console.error("Bids route failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
