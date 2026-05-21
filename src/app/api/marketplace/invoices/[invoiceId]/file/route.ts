import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { findInvoiceFileById } from "@/lib/marketplace";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

/**
 * GET /api/marketplace/invoices/[invoiceId]/file
 *
 * Streams the invoice PDF. Authorized to:
 *   - the contractor org that submitted it (contractor session, own bid)
 *   - any user in the building that owns the linked ticket (condo session)
 */
export async function GET(_request: Request, ctx: RouteContext) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await ctx.params;
  const invoice = await findInvoiceFileById(invoiceId);
  if (!invoice || !invoice.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwningContractor =
    user.kind === "contractor" && user.contractorOrgId === invoice.bid.bidderId;
  const ticketBuildingId = invoice.bid.publication.ticket?.buildingId;
  const isBuildingMember =
    user.kind !== "contractor" &&
    !!ticketBuildingId &&
    user.activeBuildingId === ticketBuildingId;

  if (!isOwningContractor && !isBuildingMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Buffer | NodeJS.ReadableStream;
  let contentType: string;
  let contentLength: number;
  try {
    const r = await getStorage().read(invoice.storageKey);
    body = r.body;
    contentType = r.contentType;
    contentLength = r.contentLength;
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(contentLength),
      "Content-Disposition": `inline; filename="${(invoice.fileName ?? "invoice.pdf").replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=600",
    },
  });
}
