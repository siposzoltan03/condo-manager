import type { ComplaintStatus } from "@prisma/client";

/**
 * Valid status transitions for the complaint mediation workflow.
 *
 * Server enforces these in `updateComplaintStatus`; client uses them to
 * decide which action buttons to render. Keep the two in sync by importing
 * from this single source.
 */
export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  REPORTED: ["ACKNOWLEDGED", "RESOLVED"],
  ACKNOWLEDGED: ["WARNING_SENT", "MEDIATION", "RESOLVED", "ESCALATED"],
  WARNING_SENT: ["MEDIATION", "RESOLVED", "ESCALATED"],
  MEDIATION: ["RESOLVED", "ESCALATED", "WARNING_SENT"],
  RESOLVED: ["MEDIATION"],
  ESCALATED: ["RESOLVED"],
};

export function isAllowedTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}
