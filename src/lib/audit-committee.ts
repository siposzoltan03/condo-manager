import type { PrismaClient } from "@prisma/client";

/**
 * Phase 2 — Tht. § 27(3) audit-committee membership helpers.
 *
 * "Active committee" means: at least one active COMMITTEE_CHAIR and at
 * least two active COMMITTEE_MEMBER rows. The Hungarian statute (Tht.
 * § 27(3)) requires a committee but doesn't fix a minimum size; three
 * is the conventional minimum (1 chair + 2 members) and lines up with
 * how most condos already operate.
 *
 * Used by `audit-committee-required-banner.tsx` to decide whether the
 * mandate banner should be visible.
 */
export async function hasActiveAuditCommittee(
  prisma: Pick<PrismaClient, "auditorMembership">,
  buildingId: string,
): Promise<boolean> {
  const [chairCount, memberCount] = await Promise.all([
    prisma.auditorMembership.count({
      where: { buildingId, kind: "COMMITTEE_CHAIR", endedAt: null },
    }),
    prisma.auditorMembership.count({
      where: { buildingId, kind: "COMMITTEE_MEMBER", endedAt: null },
    }),
  ]);
  return chairCount >= 1 && memberCount >= 2;
}

/**
 * True if there's a Tht. § 51/A registered external auditor on file.
 * Independent of the internal committee — § 51/A mandates this above
 * 50 units OR above 20M HUF cashflow, regardless of committee size.
 */
export async function hasActiveRegisteredAuditor(
  prisma: Pick<PrismaClient, "auditorMembership">,
  buildingId: string,
): Promise<boolean> {
  const count = await prisma.auditorMembership.count({
    where: { buildingId, kind: "REGISTERED_AUDITOR", endedAt: null },
  });
  return count > 0;
}
