import { NextResponse } from "next/server";
import { requireContractorOwner } from "@/lib/contractor/session";
import { getOrgForGdprExport } from "@/lib/contractor";
import {
  listAllBidsByOrgForExport,
  listAllMessagesByOrgForExport,
} from "@/lib/marketplace";

export const runtime = "nodejs";

/**
 * GET /api/contractor/settings/export
 *
 * GDPR Article 15 — returns a JSON dump of everything the marketplace
 * stores about the requesting contractor org. OWNER-only. Bid bodies +
 * message threads are included verbatim; password hashes obviously are
 * not.
 *
 * Cross-domain composition: the route pulls contractor-owned data from
 * the contractor DAL (org + users + documents + ratings) and
 * marketplace-owned data from the marketplace DAL (bids + messages),
 * then merges into one payload. This is the §1 pattern — services /
 * DALs don't reach across domains; the HTTP layer does the stitching.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await requireContractorOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [org, bids, messages] = await Promise.all([
    getOrgForGdprExport(ctx.orgId),
    listAllBidsByOrgForExport(ctx.orgId),
    listAllMessagesByOrgForExport(ctx.orgId),
  ]);
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    gdprArticle: "Article 15",
    org: {
      id: org.id,
      name: org.name,
      taxId: org.taxId,
      navConfirmedAt: org.navConfirmedAt,
      specialties: org.specialties,
      regions: org.regions,
      description: org.description,
      websiteUrl: org.websiteUrl,
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
      currentPeriodEndsAt: org.currentPeriodEndsAt,
      status: org.status,
      dpaSignedAt: org.dpaSignedAt,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    },
    users: org.users,
    documents: org.documents,
    ratings: org.ratings,
    bids: bids.map((b) => ({ ...b, amount: Number(b.amount) })),
    messages,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `kozos-contractor-export-${org.id}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
