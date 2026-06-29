import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { createAwardVote, findTicketForAwardRoute } from "@/lib/marketplace";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/maintenance/tickets/[id]/bids/put-to-vote  { meetingId }
 *
 * Puts a published ticket's open bids to an owners' vote at the given
 * közgyűlés. Starting a vote is representative authority (Tht. §43), so it
 * shares the `vote.start` capability. Freezes the publication (PENDING_VOTE)
 * and adds the bid-vote agenda point; the winning bid is awarded
 * automatically when the vote closes.
 */
export async function POST(request: Request, ctx: RouteContext) {
  let actor;
  try {
    actor = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireFeature(actor.buildingId, "voting");
  } catch (err) {
    if (err instanceof FeatureGateError) {
      return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
    }
    throw err;
  }

  if (!allows(actor, "vote.start")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const meetingId = typeof body?.meetingId === "string" ? body.meetingId : "";
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }

  const ticket = await findTicketForAwardRoute(ticketId);
  if (!ticket || ticket.buildingId !== actor.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ticket.publication) {
    return NextResponse.json({ error: "Not published" }, { status: 404 });
  }

  const result = await createAwardVote({
    publicationId: ticket.publication.id,
    meetingId,
    buildingId: actor.buildingId,
    createdByUserId: actor.userId,
  });

  if (!result.ok) {
    const status = result.reason === "NOT_OPEN" ? 409 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ ok: true, voteId: result.voteId });
}
