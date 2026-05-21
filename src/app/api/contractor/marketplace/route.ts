import { NextRequest, NextResponse } from "next/server";
import { requireContractor } from "@/lib/contractor/session";
import { getOrgSpecialties } from "@/lib/contractor";
import { getOpenPublications } from "@/lib/marketplace";
import { isPublicationUrgency } from "@/lib/marketplace/category-mapping";
import {
  isSpecialtySlug,
  type SpecialtySlug,
} from "@/lib/contractor/taxonomy";

export const runtime = "nodejs";

/**
 * GET /api/contractor/marketplace
 *
 * Returns OPEN publications matched against the contractor's
 * specialties (and optionally specialty/urgency/city filters from the
 * UI). City filter falls back to the contractor's region prefix when
 * none is provided — Phase 5 wires that in via the best-fit ranker.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireContractor();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.orgStatus !== "ACTIVE") {
    return NextResponse.json(
      { error: "Contractor org not active." },
      { status: 403 },
    );
  }

  const org = await getOrgSpecialties(ctx.orgId);
  const orgSpecs = Array.isArray(org?.specialties)
    ? (org!.specialties as SpecialtySlug[])
    : [];

  const url = request.nextUrl;
  const specialtyParam = url.searchParams.get("specialty");
  const urgency = url.searchParams.get("urgency");
  const city = url.searchParams.get("city") ?? undefined;
  const postedWithinDays =
    Number(url.searchParams.get("postedWithinDays") ?? "") || undefined;

  // If the caller restricts to one specialty, validate it. Otherwise
  // we use the org's full specialty list.
  const specialtyFilter =
    specialtyParam && isSpecialtySlug(specialtyParam)
      ? [specialtyParam]
      : orgSpecs;

  const rows = await getOpenPublications({
    specialties: specialtyFilter,
    city,
    postedWithinDays,
    excludeBidByOrgId: undefined, // we want to show even after the org bid, so they can edit
    take: 100,
  });

  // Optional urgency filter (cheap to apply in-app).
  const filtered = isPublicationUrgency(urgency)
    ? rows.filter((p) => p.urgency === urgency)
    : rows;

  return NextResponse.json({
    publications: filtered.map((p) => ({
      id: p.id,
      scrubbedTitle: p.scrubbedTitle,
      scrubbedDescription: p.scrubbedDescription,
      category: p.category,
      urgency: p.urgency,
      city: p.city,
      zip: p.zip,
      budgetBand: p.budgetBand,
      deadlineAt: p.deadlineAt?.toISOString() ?? null,
      specialties: p.specialties,
      publishedAt: p.publishedAt.toISOString(),
      publisherDisplayName: p.publisherDisplayName,
      bidsCount: p._count.bids,
    })),
  });
}
