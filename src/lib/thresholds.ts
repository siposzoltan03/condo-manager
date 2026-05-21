import type { Building, PrismaClient } from "@prisma/client";

/**
 * Threshold derivation for the four legal limits the Hungarian condo
 * statute (Tht.) imposes on a building. Plan ref:
 * docs/plans/2026-04-27-roles-legal-alignment.md, Phase 4.
 *
 * Statutes encoded:
 * - § 27(3) — audit committee mandatory above 25 lakás
 * - § 51/A — registered external auditor mandatory above 50 units
 *   OR above 20M HUF annual cashflow
 * - § 55   — professional manager may be compelled above 6 units
 * - § 13(2) — SZMSZ required for buildings of 7+ units
 */

// Use the BigInt() constructor rather than the `n` literal suffix so this
// compiles under tsconfig targets below ES2020.
const TWENTY_M = BigInt(20_000_000);

export interface ThresholdInputs {
  totalUnits: number;
  annualCashflowHUF: bigint;
}

export interface ThresholdFlags {
  requiresAuditCommittee: boolean;
  requiresExternalAuditor: boolean;
  requiresProfessionalManager: boolean;
  szmszRequired: boolean;
}

export function deriveThresholdFlags(b: ThresholdInputs): ThresholdFlags {
  return {
    requiresAuditCommittee: b.totalUnits > 25,
    requiresExternalAuditor: b.totalUnits > 50 || b.annualCashflowHUF > TWENTY_M,
    requiresProfessionalManager: b.totalUnits > 6,
    szmszRequired: b.totalUnits >= 7,
  };
}

/**
 * Recompute `totalUnits`, threshold flags, and write them back to the
 * Building row. Call from unit CRUD actions (after insert/delete) and
 * from a nightly worker once cashflow is wired up.
 *
 * `annualCashflowHUF` is currently NOT recomputed here — the LedgerEntry
 * shape needs verification before we sum it. The Building row keeps
 * whatever cashflow was last written (default 0). Marking as TODO.
 */
export async function refreshBuildingThresholds(
  prisma: Pick<PrismaClient, "building">,
  buildingId: string,
): Promise<ThresholdFlags & { totalUnits: number }> {
  const building = await prisma.building.findUniqueOrThrow({
    where: { id: buildingId },
    select: {
      id: true,
      annualCashflowHUF: true,
      units: { select: { id: true } },
    },
  });
  const totalUnits = building.units.length;
  const flags = deriveThresholdFlags({
    totalUnits,
    annualCashflowHUF: building.annualCashflowHUF,
  });
  await prisma.building.update({
    where: { id: buildingId },
    data: { totalUnits, ...flags },
  });
  return { totalUnits, ...flags };
}

/**
 * Pure helper for surfacing thresholds in the UI without an extra DB
 * round-trip. Pass the Building row directly.
 */
export function thresholdSummary(
  b: Pick<Building, "totalUnits" | "annualCashflowHUF">,
): ThresholdFlags & ThresholdInputs {
  return {
    totalUnits: b.totalUnits,
    annualCashflowHUF: b.annualCashflowHUF,
    ...deriveThresholdFlags(b),
  };
}
