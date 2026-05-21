import { NextResponse } from "next/server";
import { requireContractor } from "@/lib/contractor/session";
import { isValidTransition } from "@/lib/maintenance/tickets";
import {
  findBidForStatusUpdate,
  setTicketStatus,
  projectStatusAdvanced,
} from "@/lib/marketplace";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ bidId: string }>;
}

const ALLOWED_NEXT = new Set(["IN_PROGRESS", "COMPLETED"]);

/**
 * POST /api/contractor/projects/[bidId]/status
 *
 * Contractor-driven status updates on a won project. Only forward moves
 * are allowed (ASSIGNED → IN_PROGRESS → COMPLETED). VERIFIED stays
 * board-side — that's the board signing off after marking the invoice
 * paid. The board is notified on every transition.
 */
export async function POST(request: Request, ctx: RouteContext) {
  let session;
  try {
    session = await requireContractor();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.orgStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Org not active" }, { status: 403 });
  }

  const { bidId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    next?: string;
  } | null;
  const next = body?.next;
  if (!next || !ALLOWED_NEXT.has(next)) {
    return NextResponse.json(
      { error: "Invalid target status" },
      { status: 400 },
    );
  }

  const bid = await findBidForStatusUpdate(bidId);
  if (!bid || bid.bidderId !== session.orgId || bid.status !== "WON") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ticket = bid.publication.ticket;
  if (!ticket) {
    return NextResponse.json({ error: "Ticket missing" }, { status: 409 });
  }
  if (!isValidTransition(ticket.status, next)) {
    return NextResponse.json(
      { error: "Invalid transition", reason: "INVALID_TRANSITION" },
      { status: 409 },
    );
  }

  const oldStatus = ticket.status;
  await setTicketStatus(ticket.id, next as "IN_PROGRESS" | "COMPLETED");

  await projectStatusAdvanced({
    ticketId: ticket.id,
    publishedById: bid.publication.publishedById,
    scrubbedTitle: bid.publication.scrubbedTitle,
    ticketTrackingNumber: ticket.trackingNumber,
    next: next as "IN_PROGRESS" | "COMPLETED",
  });

  return NextResponse.json({
    ok: true,
    ticketStatus: next,
    previous: oldStatus,
  });
}
