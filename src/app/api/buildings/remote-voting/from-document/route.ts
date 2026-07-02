import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireNotFrozen, FrozenBuildingError } from "@/lib/frozen-check";

export const runtime = "nodejs";

/**
 * POST /api/buildings/remote-voting/from-document — record that the building's
 * SZMSZ authorises electronic/hybrid voting, evidenced by an actual uploaded
 * SZMSZ / alapító okirat document version (the clause the LLM detected on
 * upload, confirmed by a human). This is NOT a manual toggle: it references the
 * adopted legal instrument as the proof. If the SZMSZ does not contain such a
 * clause, use the SZMSZ-amendment (assembly vote) flow instead.
 *
 * Body: { documentId, versionId, section? }. Gated by bylaws.modify. Audited.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "bylaws.modify");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { userId, buildingId } = ctx;
    await requireNotFrozen(buildingId);

    const body = await request.json().catch(() => null);
    const documentId = typeof body?.documentId === "string" ? body.documentId : "";
    const versionId = typeof body?.versionId === "string" ? body.versionId : "";
    const section = typeof body?.section === "string" ? body.section.trim() : "";
    if (!documentId || !versionId) {
      return NextResponse.json({ error: "documentId and versionId are required." }, { status: 400 });
    }

    // The document must be this building's SZMSZ / alapító okirat, and the
    // version must belong to it — that adopted instrument is the evidence.
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        kind: true,
        category: { select: { buildingId: true } },
        versions: { where: { id: versionId }, select: { id: true, versionNumber: true } },
      },
    });
    if (!doc || doc.category.buildingId !== buildingId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (doc.kind !== "SZMSZ" && doc.kind !== "COMBINED" && doc.kind !== "FOUNDING_DEED") {
      return NextResponse.json(
        { error: "Only the SZMSZ or alapító okirat can authorise remote voting." },
        { status: 400 },
      );
    }
    if (doc.versions.length === 0) {
      return NextResponse.json({ error: "versionId does not belong to this document." }, { status: 400 });
    }

    const versionNumber = doc.versions[0].versionNumber;
    const ref = `${doc.title} v${versionNumber}${section ? ` · ${section}` : ""}`;

    await prisma.building.update({
      where: { id: buildingId },
      data: { remoteVotingAuthorized: true, remoteVotingSzmszRef: ref },
    });

    await createAuditLog({
      entityType: "Building",
      entityId: buildingId,
      action: "UPDATE",
      userId,
      buildingId,
      oldValue: { remoteVotingAuthorized: false },
      newValue: {
        remoteVotingAuthorized: true,
        source: "szmsz-document",
        documentId,
        versionId,
        section: section || null,
      },
      reason: "Remote voting authorised from an SZMSZ clause detected in the uploaded document.",
    });

    return NextResponse.json({ ok: true, remoteVotingSzmszRef: ref });
  } catch (error) {
    if (error instanceof FrozenBuildingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Remote-voting authorisation from document failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
