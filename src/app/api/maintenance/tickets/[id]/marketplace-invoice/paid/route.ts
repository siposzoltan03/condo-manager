import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { isValidTransition } from "@/lib/maintenance/tickets";
import { sendEmail } from "@/lib/email";
import {
  findTicketForMarkPaidRoute,
  setInvoicePaid,
  setTicketStatus,
  runTransaction,
  invoiceWasPaid,
} from "@/lib/marketplace";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/maintenance/tickets/[id]/marketplace-invoice/paid
 *
 * Board action: mark the marketplace invoice PAID and close the project
 * out by advancing the ticket COMPLETED → VERIFIED in the same
 * transaction. Only BOARD_MEMBER+ can run this. Returns the updated
 * ticket status so the client can refresh.
 */
export async function POST(_request: Request, ctx: RouteContext) {
  let session;
  try {
    session = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinimumRole(session.role, "BOARD_MEMBER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId } = await ctx.params;

  const ticket = await findTicketForMarkPaidRoute(ticketId);
  if (!ticket || ticket.buildingId !== session.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const invoice = ticket.publication?.awardedBid?.invoice;
  if (!invoice) {
    return NextResponse.json(
      { error: "No invoice to mark paid" },
      { status: 404 },
    );
  }
  if (invoice.status === "PAID") {
    return NextResponse.json(
      { error: "Already paid" },
      { status: 409 },
    );
  }
  if (!isValidTransition(ticket.status, "VERIFIED")) {
    return NextResponse.json(
      {
        error: `Ticket status ${ticket.status} can't advance to VERIFIED`,
      },
      { status: 409 },
    );
  }

  const now = new Date();
  await runTransaction(async (tx) => {
    await setInvoicePaid(invoice.id, now, session.userId, tx);
    await setTicketStatus(ticket.id, "VERIFIED", tx);
  });

  const contractor = ticket.publication?.awardedBid?.bidder.users[0];
  if (contractor) {
    await invoiceWasPaid({
      invoiceId: invoice.id,
      buildingId: session.buildingId,
      paidByUserId: session.userId,
      contractorUserId: contractor.id,
      scrubbedTitle: ticket.publication?.scrubbedTitle ?? ticket.trackingNumber,
      invoiceNumber: invoice.invoiceNumber,
    });

    const subject = `Számla kifizetve — ${ticket.trackingNumber}`;
    const html = `
      <p>Szia ${contractor.name},</p>
      <p>A megrendelő kifizettnek jelölte a(z) <b>${invoice.invoiceNumber}</b> számláját
      a következő munkához: <b>${ticket.publication?.scrubbedTitle ?? ticket.trackingNumber}</b>.</p>
      <p>A munka most már <b>lezárt</b> állapotba került.</p>
      <p>— Közös</p>
    `;
    sendEmail(contractor.email, subject, html).catch((err) =>
      console.error("Invoice-paid email failed:", err),
    );
  }

  return NextResponse.json({ ok: true });
}
