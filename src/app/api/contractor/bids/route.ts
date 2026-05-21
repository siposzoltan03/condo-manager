import { NextRequest, NextResponse } from "next/server";
import { requireContractor } from "@/lib/contractor/session";
import {
  createOrUpdateBid,
  bidWasSubmitted,
  bidWasUpdated,
} from "@/lib/marketplace";

export const runtime = "nodejs";

/**
 * POST /api/contractor/bids
 *
 * Create or update a bid on a publication. Returns:
 *   - 200 with { ok: true, bidId, updated: boolean } on success
 *   - 400 with { ok: false, reason } on validation failure
 *
 * Side effects (audit + notify) live in the marketplace events helpers.
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireContractor();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        publicationId?: string;
        amount?: number;
        etaDays?: number;
        notes?: string | null;
      }
    | null;
  if (!body?.publicationId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const amount = Number(body.amount);
  const etaDays = Math.floor(Number(body.etaDays));
  const notesTrimmed =
    typeof body.notes === "string" ? body.notes.trim().slice(0, 800) : null;

  const result = await createOrUpdateBid({
    publicationId: body.publicationId,
    bidderOrgId: session.orgId,
    amount,
    etaDays,
    notes: notesTrimmed || null,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  if (result.updated) {
    bidWasUpdated({
      bidId: result.bidId,
      userId: session.userId,
      amount,
      etaDays,
    }).catch((err) => console.error("bidWasUpdated event failed:", err));
  } else {
    bidWasSubmitted({
      bidId: result.bidId,
      userId: session.userId,
      amount,
      etaDays,
      publicationId: body.publicationId,
    }).catch((err) => console.error("bidWasSubmitted event failed:", err));
  }

  return NextResponse.json(result);
}
