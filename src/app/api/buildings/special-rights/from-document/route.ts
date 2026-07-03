import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";
import { recordSpecialRightsFromVersion } from "@/lib/special-rights";
import type { ExtractedSpecialRight } from "@/lib/legal-doc-extract";

export const runtime = "nodejs";

const KINDS = ["EXCLUSIVE_USE", "PRE_EMPTION", "PARKING", "STORAGE", "OTHER"];

/**
 * POST /api/buildings/special-rights/from-document — record the special rights
 * (különleges jogok) the building's alapító okirat grants, evidenced by an
 * actual founding-deed document version (the rights the LLM detected on upload,
 * confirmed by a human). units.manage-gated (register data). Audited.
 *
 * Body: { documentId, versionId, rights: ExtractedSpecialRight[] }.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "units.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { userId, buildingId } = ctx;
    await requireNotFrozen(buildingId);

    const body = await request.json().catch(() => null);
    const documentId = typeof body?.documentId === "string" ? body.documentId : "";
    const versionId = typeof body?.versionId === "string" ? body.versionId : "";
    const rawRights = Array.isArray(body?.rights) ? body.rights : [];
    if (!documentId || !versionId) {
      return NextResponse.json({ error: "documentId and versionId are required." }, { status: 400 });
    }

    // The document must be this building's founding deed, and the version must
    // belong to it — that adopted instrument is the evidence.
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        kind: true,
        category: { select: { buildingId: true } },
        versions: { where: { id: versionId }, select: { id: true } },
      },
    });
    if (!doc || doc.category.buildingId !== buildingId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (doc.kind !== "FOUNDING_DEED" && doc.kind !== "COMBINED") {
      return NextResponse.json(
        { error: "Only the alapító okirat can grant special rights." },
        { status: 400 },
      );
    }
    if (doc.versions.length === 0) {
      return NextResponse.json({ error: "versionId does not belong to this document." }, { status: 400 });
    }

    // Sanitise the reviewed rights payload.
    const rights: ExtractedSpecialRight[] = rawRights
      .filter(
        (r: unknown): r is Record<string, unknown> =>
          !!r && typeof r === "object" &&
          typeof (r as Record<string, unknown>).description === "string" &&
          KINDS.includes((r as Record<string, unknown>).kind as string),
      )
      .map((r: Record<string, unknown>) => ({
        kind: r.kind as ExtractedSpecialRight["kind"],
        description: (r.description as string).slice(0, 2000),
        unitNumber: typeof r.unitNumber === "string" ? r.unitNumber : null,
        location: typeof r.location === "string" ? r.location : null,
        areaSize: typeof r.areaSize === "number" && Number.isFinite(r.areaSize) ? r.areaSize : null,
        section: typeof r.section === "string" ? r.section : null,
      }));

    const { recorded } = await recordSpecialRightsFromVersion(prisma, {
      buildingId,
      versionId,
      actorId: userId,
      rights,
    });

    return NextResponse.json({ ok: true, recorded });
  } catch (error) {
    if (error instanceof FrozenBuildingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Recording special rights from document failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
