import type { Building } from "@prisma/client";

/**
 * Officer-registry status derivation for the Tht. § 55/A–D földhivatal
 * registration deadline. Plan ref:
 * docs/plans/2026-04-27-roles-legal-alignment.md, Phase 4.
 *
 * Deadline: 2026-10-31 (extended by 2025. évi LXXXVIII. tv.).
 *
 * Once the deadline passes, unregistered közös képviselő is invalid
 * representation against third parties. Buildings need to act before
 * then; the banner / admin page surface that urgency.
 */

const DUE_SOON_WINDOW_DAYS = 60;
const MS_PER_DAY = 86_400_000;

export type RegistryStatus =
  | { kind: "registered"; at: Date }
  | { kind: "due-soon"; daysLeft: number; deadline: Date }
  | { kind: "overdue"; daysOverdue: number; deadline: Date }
  | { kind: "ok"; daysLeft: number; deadline: Date };

export type RegistryStatusKind = RegistryStatus["kind"];

export function getRegistryStatus(
  b: Pick<Building, "representativeRegisteredAt" | "representativeRegistryDeadline">,
  now: Date = new Date(),
): RegistryStatus {
  if (b.representativeRegisteredAt) {
    return { kind: "registered", at: b.representativeRegisteredAt };
  }
  const deadline = b.representativeRegistryDeadline;
  const diffDays = Math.floor((deadline.getTime() - now.getTime()) / MS_PER_DAY);
  if (diffDays < 0) {
    return { kind: "overdue", daysOverdue: -diffDays, deadline };
  }
  if (diffDays <= DUE_SOON_WINDOW_DAYS) {
    return { kind: "due-soon", daysLeft: diffDays, deadline };
  }
  return { kind: "ok", daysLeft: diffDays, deadline };
}

/**
 * Convenience predicate for "should we nag the user?" — true when status
 * is due-soon or overdue. Lets banners decide visibility with one call.
 */
export function shouldNagAboutRegistry(s: RegistryStatus): boolean {
  return s.kind === "due-soon" || s.kind === "overdue";
}
