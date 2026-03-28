import { prisma } from "@/lib/prisma";

const MAX_RETRIES = 5;

export async function generateTrackingNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `MNT-${currentYear}-`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const count = await prisma.maintenanceTicket.count({
      where: {
        trackingNumber: { startsWith: prefix },
      },
    });

    const nextNumber = count + 1;
    const trackingNumber = `${prefix}${String(nextNumber).padStart(4, "0")}`;

    try {
      // Validate uniqueness by attempting a find; the actual create
      // happens in the caller. If a collision occurs at create-time the
      // caller should catch P2002 and call this function again.
      const existing = await prisma.maintenanceTicket.findUnique({
        where: { trackingNumber },
        select: { id: true },
      });
      if (!existing) {
        return trackingNumber;
      }
      // Collision — retry with updated count
    } catch {
      // Retry on transient errors
    }
  }

  throw new Error("Failed to generate tracking number");
}

/**
 * Valid status transitions for the maintenance ticket workflow.
 * SUBMITTED -> ACKNOWLEDGED -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> VERIFIED
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["VERIFIED"],
  VERIFIED: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
