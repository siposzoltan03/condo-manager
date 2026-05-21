import { NextResponse } from "next/server";
import { requireContractor } from "@/lib/contractor/session";
import {
  getBidByContractor,
  getHistoricalMedian,
  findPublicationForContractorDetail,
} from "@/lib/marketplace";
import type { SpecialtySlug } from "@/lib/contractor/taxonomy";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contractor/marketplace/[id]
 *
 * Single publication detail for the contractor side. Returns the
 * scrubbed publication, the contractor's current bid (if any), and the
 * historical median widget data (null when sample < 10).
 */
export async function GET(_request: Request, ctx: RouteContext) {
  let session;
  try {
    session = await requireContractor();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.orgStatus !== "ACTIVE") {
    return NextResponse.json(
      { error: "Contractor org not active." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const pub = await findPublicationForContractorDetail(id);
  if (!pub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Contractors only see OPEN publications; AWARDED/CLOSED are not
  // browsable from this surface.
  if (pub.status !== "OPEN") {
    return NextResponse.json({ error: "Not open" }, { status: 410 });
  }

  const bid = await getBidByContractor(pub.id, session.orgId);
  const specialties = Array.isArray(pub.specialties)
    ? (pub.specialties as SpecialtySlug[])
    : [];
  const primarySpec = specialties[0];
  const median = primarySpec
    ? await getHistoricalMedian(primarySpec, pub.city)
    : null;

  return NextResponse.json({
    publication: {
      id: pub.id,
      scrubbedTitle: pub.scrubbedTitle,
      scrubbedDescription: pub.scrubbedDescription,
      category: pub.category,
      urgency: pub.urgency,
      city: pub.city,
      zip: pub.zip,
      budgetBand: pub.budgetBand,
      deadlineAt: pub.deadlineAt?.toISOString() ?? null,
      specialties,
      publishedAt: pub.publishedAt.toISOString(),
      publisherDisplayName: pub.publisherDisplayName,
      bidsCount: pub._count.bids,
    },
    bid: bid
      ? {
          id: bid.id,
          amount: Number(bid.amount),
          etaDays: bid.etaDays,
          notes: bid.notes,
          status: bid.status,
          decisionReason: bid.decisionReason,
          updatedAt: bid.updatedAt.toISOString(),
        }
      : null,
    median,
  });
}
