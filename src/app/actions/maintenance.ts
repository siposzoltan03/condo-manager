"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireNotFrozen } from "@/lib/frozen-check";
import { requireFeature } from "@/lib/feature-gate";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma, MaintenanceCategory, Urgency } from "@prisma/client";

interface ActionResult {
  success?: boolean;
  error?: string;
  trackingNumber?: string;
}

interface CreateTicketInput {
  title: string;
  description: string;
  category: string;
  urgency: string;
  location?: string;
  slaHours?: number | null;
}

export async function createTicket(input: CreateTicketInput): Promise<ActionResult> {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    await requireFeature(buildingId, "maintenance");
    await requireNotFrozen(buildingId);

    const { title, description, category, urgency, location, slaHours } = input;

    if (!title || !description || !category || !urgency) {
      return { error: "Missing required fields" };
    }

    if (!Object.values(MaintenanceCategory).includes(category as MaintenanceCategory)) {
      return { error: "Invalid category" };
    }

    if (!Object.values(Urgency).includes(urgency as Urgency)) {
      return { error: "Invalid urgency" };
    }

    let normalizedSla: number | null = null;
    if (slaHours !== undefined && slaHours !== null) {
      if (!Number.isInteger(slaHours) || slaHours < 1 || slaHours > 720) {
        return { error: "slaHours must be an integer between 1 and 720" };
      }
      normalizedSla = slaHours;
    }

    // Generate tracking number with retry
    const MAX_RETRIES = 5;
    let ticket;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const currentYear = new Date().getFullYear();
      const prefix = `MNT-${currentYear}-`;

      const lastTicket = await prisma.maintenanceTicket.findFirst({
        where: { trackingNumber: { startsWith: prefix } },
        orderBy: { trackingNumber: "desc" },
        select: { trackingNumber: true },
      });

      let nextNumber = 1;
      if (lastTicket) {
        const lastNum = parseInt(lastTicket.trackingNumber.split("-")[2], 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }

      const trackingNumber = `${prefix}${String(nextNumber).padStart(3, "0")}`;

      try {
        ticket = await prisma.maintenanceTicket.create({
          data: {
            trackingNumber,
            title,
            description,
            category: category as MaintenanceCategory,
            urgency: urgency as Urgency,
            location: location || null,
            slaHours: normalizedSla,
            reporter: { connect: { id: userId } },
            building: { connect: { id: buildingId } },
          },
        });
        break;
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < MAX_RETRIES - 1
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!ticket) {
      return { error: "Failed to generate unique tracking number" };
    }

    await createAuditLog({
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      action: "CREATE",
      userId,
      buildingId,
      newValue: { trackingNumber: ticket.trackingNumber, title, category, urgency },
    });

    revalidatePath("/maintenance");
    return { success: true, trackingNumber: ticket.trackingNumber };
  } catch (error) {
    console.error("Failed to create ticket:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
