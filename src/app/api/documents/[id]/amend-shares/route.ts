import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";

export const runtime = "nodejs";

// Shares must sum to ~100% of the building.
const SHARE_SUM_EPS = 0.0005;
// A per-unit change smaller than this is treated as no change.
const SHARE_EPS = 0.00005;

interface AmendUnit {
  number: string;
  ownershipShare: number;
}

/**
 * POST /api/documents/[id]/amend-shares — amend unit ownership shares
 * (tulajdoni hányad) from a new version of the alapító okirat (founding deed).
 *
 * This is the ONLY path that may change `Unit.ownershipShare` — the casual unit
 * edit paths reject share changes. Ownership share is legal-register data whose
 * change legally needs all owners' consent + notarial/attorney form, so the
 * caller must attest to that (a reference to the amending deed is recorded in
 * the audit trail). ADMIN-only via `foundingDeed.amend`.
 *
 * Body: { versionId, units: [{ number, ownershipShare }], attestation: { reference } }
 * Applies the new shares in one transaction, stamps each amended unit's
 * provenance (`ownershipShareSourceVersionId`), and writes a per-unit audit row.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "foundingDeed.amend");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { userId, buildingId } = ctx;
    await requireNotFrozen(buildingId);

    const { id: documentId } = await context.params;
    const body = await request.json().catch(() => null);
    const versionId: unknown = body?.versionId;
    const rawUnits: unknown = body?.units;
    const reference: unknown = body?.attestation?.reference;

    if (typeof reference !== "string" || reference.trim().length === 0) {
      return NextResponse.json(
        { error: "An attestation reference (deed date / notary or attorney) is required." },
        { status: 400 },
      );
    }
    if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
      return NextResponse.json({ error: "No units provided." }, { status: 400 });
    }
    const units: AmendUnit[] = [];
    for (const u of rawUnits) {
      const num = typeof u?.number === "string" ? u.number.trim() : "";
      const share = Number(u?.ownershipShare);
      if (!num || !Number.isFinite(share) || share < 0 || share > 1) {
        return NextResponse.json(
          { error: `Invalid unit entry: ${JSON.stringify(u)}` },
          { status: 400 },
        );
      }
      units.push({ number: num, ownershipShare: share });
    }

    // The document must be this building's founding deed (or combined) and the
    // version must belong to it — the deed that authorises the amendment.
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        kind: true,
        category: { select: { buildingId: true } },
        versions: { where: { id: typeof versionId === "string" ? versionId : "" }, select: { id: true } },
      },
    });
    if (!doc || doc.category.buildingId !== buildingId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (doc.kind !== "FOUNDING_DEED" && doc.kind !== "COMBINED") {
      return NextResponse.json(
        { error: "Only the founding deed (alapító okirat) can amend ownership shares." },
        { status: 400 },
      );
    }
    if (doc.versions.length === 0) {
      return NextResponse.json(
        { error: "versionId does not belong to this document." },
        { status: 400 },
      );
    }
    const sourceVersionId = doc.versions[0].id;

    // The amended shares must still sum to ~100% of the building.
    const total = units.reduce((s, u) => s + u.ownershipShare, 0);
    if (Math.abs(total - 1) > SHARE_SUM_EPS) {
      return NextResponse.json(
        {
          error: `Ownership shares must sum to 100% (got ${(total * 100).toFixed(2)}%).`,
        },
        { status: 400 },
      );
    }

    // Match against the building's existing units by number.
    const existing = await prisma.unit.findMany({
      where: { buildingId },
      select: { id: true, number: true, ownershipShare: true },
    });
    const byNumber = new Map(existing.map((u) => [u.number, u]));
    const unknown = units.filter((u) => !byNumber.has(u.number)).map((u) => u.number);
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Unknown unit(s): ${unknown.join(", ")}` },
        { status: 400 },
      );
    }

    // Apply the changed shares + provenance in one transaction; collect the
    // per-unit deltas for the audit trail.
    const changes: { id: string; number: string; from: number; to: number }[] = [];
    for (const u of units) {
      const cur = byNumber.get(u.number)!;
      const from = Number(cur.ownershipShare);
      if (Math.abs(u.ownershipShare - from) > SHARE_EPS) {
        changes.push({ id: cur.id, number: u.number, from, to: u.ownershipShare });
      }
    }

    if (changes.length > 0) {
      await prisma.$transaction([
        ...changes.map((c) =>
          prisma.unit.update({
            where: { id: c.id },
            data: {
              ownershipShare: new Prisma.Decimal(c.to),
              ownershipShareSourceVersionId: sourceVersionId,
            },
          }),
        ),
      ]);
    }

    // One audit row for the amendment (per-unit deltas + the legal attestation).
    await createAuditLog({
      entityType: "Building",
      entityId: buildingId,
      action: "UPDATE",
      userId,
      buildingId,
      oldValue: { ownershipShares: changes.map((c) => ({ number: c.number, share: c.from })) },
      newValue: {
        amendedFromDocumentId: documentId,
        amendedFromVersionId: sourceVersionId,
        attestationReference: reference.trim(),
        allOwnersConsented: true,
        ownershipShares: changes.map((c) => ({ number: c.number, share: c.to })),
      },
      reason: `Ownership shares amended from founding deed (${changes.length} unit(s)).`,
    });

    return NextResponse.json({ ok: true, changed: changes.length, unchanged: units.length - changes.length });
  } catch (error) {
    if (error instanceof FrozenBuildingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Ownership-share amendment failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
