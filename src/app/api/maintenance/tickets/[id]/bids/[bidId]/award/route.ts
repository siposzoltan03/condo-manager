import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import {
  awardBid,
  findTicketForAwardRoute,
  dispatchAwardOutcome,
} from "@/lib/marketplace";

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

  // Audit + winner/loser emails (shared with the vote-driven auto-award).
  await dispatchAwardOutcome(outcome, userBlock.userId);

  return NextResponse.json({ ok: true, outcome });
}
