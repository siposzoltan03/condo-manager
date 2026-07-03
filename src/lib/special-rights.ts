import type { PrismaClient, SpecialRightKind } from "@prisma/client";
import type { ExtractedSpecialRight } from "@/lib/legal-doc-extract";

/**
 * Special rights (különleges jogok) recorded from the alapító okirat — e.g.
 * exclusive-use rights over common area, pre-emption rights, parking spaces and
 * storage units. Like ownership shares these are register facts: recorded from
 * an adopted founding-deed DocumentVersion (evidence), with an audited manual
 * add/remove path for grants that arise later.
 *
 * prisma-param (like retention.ts / gdpr.ts) so it's unit-testable and reusable
 * by the from-document route AND the manual actions.
 */

export interface RecordFromVersionInput {
  buildingId: string;
  /** The founding-deed DocumentVersion these rights are evidenced by. */
  versionId: string;
  actorId: string;
  rights: ExtractedSpecialRight[];
}

/**
 * Replace the building's special rights sourced from the given founding-deed
 * version with the reviewed extraction. Re-recording the same version is
 * idempotent (prior rows from that version are removed first). Unit numbers are
 * resolved to the building's units; unmatched numbers become building-wide
 * rights (unitId = null). Returns the number of rights recorded.
 */
export async function recordSpecialRightsFromVersion(
  prisma: Pick<PrismaClient, "unit" | "specialRight" | "auditLog">,
  input: RecordFromVersionInput,
): Promise<{ recorded: number }> {
  const { buildingId, versionId, actorId, rights } = input;

  const units = await prisma.unit.findMany({
    where: { buildingId },
    select: { id: true, number: true },
  });
  const byNumber = new Map(units.map((u) => [u.number.trim().toLowerCase(), u.id]));

  // Idempotent re-record: drop prior rows evidenced by this same version.
  await prisma.specialRight.deleteMany({ where: { buildingId, sourceVersionId: versionId } });

  const data = rights.map((r) => ({
    buildingId,
    unitId: r.unitNumber ? (byNumber.get(r.unitNumber.trim().toLowerCase()) ?? null) : null,
    kind: r.kind as SpecialRightKind,
    description: r.description,
    location: r.location ?? null,
    areaSize: r.areaSize ?? null,
    sourceVersionId: versionId,
    sourceSection: r.section ?? null,
  }));

  if (data.length > 0) {
    await prisma.specialRight.createMany({ data });
  }

  await prisma.auditLog.create({
    data: {
      entityType: "Building",
      entityId: buildingId,
      action: "UPDATE",
      userId: actorId,
      buildingId,
      newValue: { specialRightsRecorded: data.length, sourceVersionId: versionId },
      reason: "Special rights recorded from the founding-deed document.",
    },
  });

  return { recorded: data.length };
}

/** List a building's special rights, newest first, with the attached unit. */
export async function listSpecialRights(
  prisma: Pick<PrismaClient, "specialRight">,
  buildingId: string,
) {
  return prisma.specialRight.findMany({
    where: { buildingId },
    select: {
      id: true,
      kind: true,
      description: true,
      location: true,
      areaSize: true,
      sourceSection: true,
      sourceVersionId: true,
      createdAt: true,
      unit: { select: { id: true, number: true } },
    },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
}

export type SpecialRightRow = Awaited<ReturnType<typeof listSpecialRights>>[number];
