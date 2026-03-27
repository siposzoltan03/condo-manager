import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const MAX_RETRIES = 5;

export async function generateTrackingNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `MNT-${currentYear}-`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const lastTicket = await prisma.maintenanceTicket.findFirst({
      where: {
        trackingNumber: { startsWith: prefix },
      },
      orderBy: { trackingNumber: "desc" },
      select: { trackingNumber: true },
    });

    let nextNumber = 1;
    if (lastTicket) {
      const lastNum = parseInt(lastTicket.trackingNumber.split("-")[2], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const trackingNumber = `${prefix}${String(nextNumber).padStart(3, "0")}`;
    return trackingNumber;
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
