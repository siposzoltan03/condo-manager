import { NextRequest, NextResponse } from "next/server";
import { requireContractor } from "@/lib/contractor/session";
import { getStorage, MAX_UPLOAD_BYTES } from "@/lib/storage";
import {
  findBidForInvoiceUpload,
  upsertInvoice,
  invoiceWasSubmitted,
} from "@/lib/marketplace";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ bidId: string }>;
}

/**
 * POST /api/contractor/projects/[bidId]/invoice
 *
 * Contractor submits the invoice for a won project. Accepts
 * multipart/form-data with required fields (invoiceNumber, grossAmount,
 * issuedAt, dueAt) and an optional PDF (`file`). The linked ticket must
 * be at COMPLETED — invoices are submitted after marking the work done.
 * One invoice per bid; resubmitting overwrites the existing record while
 * it's still PENDING.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
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

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const invoiceNumber = (form.get("invoiceNumber") ?? "").toString().trim();
  const grossRaw = (form.get("grossAmount") ?? "").toString().trim();
  const issuedAtRaw = (form.get("issuedAt") ?? "").toString().trim();
  const dueAtRaw = (form.get("dueAt") ?? "").toString().trim();
  const file = form.get("file");

  if (!invoiceNumber || invoiceNumber.length > 64) {
    return NextResponse.json(
      { error: "Invalid invoice number", reason: "INVOICE_NUMBER" },
      { status: 400 },
    );
  }
  const gross = Number(grossRaw.replace(/\s/g, ""));
  if (!Number.isFinite(gross) || gross <= 0) {
    return NextResponse.json(
      { error: "Invalid amount", reason: "GROSS" },
      { status: 400 },
    );
  }
  const issuedAt = new Date(issuedAtRaw);
  if (Number.isNaN(issuedAt.getTime())) {
    return NextResponse.json(
      { error: "Invalid issued date", reason: "ISSUED_AT" },
      { status: 400 },
    );
  }
  const dueAt = new Date(dueAtRaw);
  if (Number.isNaN(dueAt.getTime())) {
    return NextResponse.json(
      { error: "Invalid due date", reason: "DUE_AT" },
      { status: 400 },
    );
  }

  const bid = await findBidForInvoiceUpload(bidId);
  if (!bid || bid.bidderId !== session.orgId || bid.status !== "WON") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ticket = bid.publication.ticket;
  if (!ticket) {
    return NextResponse.json({ error: "Ticket missing" }, { status: 409 });
  }
  if (ticket.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Project must be marked completed first", reason: "NOT_COMPLETED" },
      { status: 409 },
    );
  }
  if (bid.invoice && bid.invoice.status === "PAID") {
    return NextResponse.json(
      { error: "Invoice already paid", reason: "ALREADY_PAID" },
      { status: 409 },
    );
  }

  let storageKey: string | null = bid.invoice?.storageKey ?? null;
  let fileName: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large", reason: "FILE_SIZE" },
        { status: 413 },
      );
    }
    const mime = (file.type || "").toLowerCase();
    if (mime !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF accepted", reason: "FILE_TYPE" },
        { status: 415 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const stored = await getStorage().put({
      scope: "marketplace-invoice",
      fileName: file.name,
      mimeType: mime,
      body: buf,
    });
    // Best-effort cleanup of the prior PDF if the contractor re-submits.
    if (bid.invoice?.storageKey && bid.invoice.storageKey !== stored.key) {
      getStorage()
        .remove(bid.invoice.storageKey)
        .catch((err) => console.error("Invoice old-file cleanup failed:", err));
    }
    storageKey = stored.key;
    fileName = file.name;
  }

  const invoice = await upsertInvoice(bidId, {
    invoiceNumber,
    grossAmount: gross,
    issuedAt,
    dueAt,
    storageKey,
    fileName,
  });

  await invoiceWasSubmitted({
    invoiceId: invoice.id,
    publicationId: bidId,
    publishedById: bid.publication.publishedById,
    scrubbedTitle: bid.publication.scrubbedTitle,
    ticketTrackingNumber: ticket.trackingNumber,
    invoiceNumber,
    grossAmount: gross,
  });

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      grossAmount: Number(invoice.grossAmount),
      issuedAt: invoice.issuedAt.toISOString(),
      dueAt: invoice.dueAt.toISOString(),
      hasFile: !!invoice.storageKey,
      fileName: invoice.fileName,
      status: invoice.status,
      paidAt: invoice.paidAt?.toISOString() ?? null,
    },
  });
}
