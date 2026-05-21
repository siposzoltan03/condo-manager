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
 * Linear status order:
 * SUBMITTED -> ACKNOWLEDGED -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> VERIFIED
 *
 * The kanban view merges ACKNOWLEDGED + ASSIGNED into one column and
 * COMPLETED + VERIFIED into another, so transitions need to be lenient enough
 * for forward drag-and-drop. Rule: any forward move (to a later status) is
 * allowed; backward moves and reflexive moves are rejected.
 */
const STATUS_RANK: Record<string, number> = {
  SUBMITTED: 0,
  ACKNOWLEDGED: 1,
  ASSIGNED: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  VERIFIED: 5,
};

export function isValidTransition(from: string, to: string): boolean {
  const fromRank = STATUS_RANK[from];
  const toRank = STATUS_RANK[to];
  if (fromRank === undefined || toRank === undefined) return false;
  return toRank > fromRank;
}
