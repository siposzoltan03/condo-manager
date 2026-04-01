"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { requireNotFrozen } from "@/lib/frozen-check";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma, ComplaintCategory, ComplaintStatus } from "@prisma/client";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface CreateComplaintInput {
  category: string;
  description: string;
  photos?: string[];
  isPrivate?: boolean;
}

export async function createComplaint(input: CreateComplaintInput): Promise<ActionResult> {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    await requireNotFrozen(buildingId);

    const { category, description, photos, isPrivate } = input;

    if (!category || !description) {
      return { error: "Missing required fields: category, description" };
    }

    if (!Object.values(ComplaintCategory).includes(category as ComplaintCategory)) {
      return { error: "Invalid category" };
    }

    // Generate tracking number with retry
    const MAX_RETRIES = 5;
    let complaint;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const currentYear = new Date().getFullYear();
      const prefix = `CMP-${currentYear}-`;

      const lastComplaint = await prisma.complaint.findFirst({
        where: { trackingNumber: { startsWith: prefix } },
        orderBy: { trackingNumber: "desc" },
        select: { trackingNumber: true },
      });

      let nextNumber = 1;
      if (lastComplaint) {
        const lastNum = parseInt(lastComplaint.trackingNumber.split("-")[2], 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }

      const trackingNumber = `${prefix}${String(nextNumber).padStart(3, "0")}`;

      try {
        complaint = await prisma.complaint.create({
          data: {
            trackingNumber,
            category: category as ComplaintCategory,
            description,
            photos: Array.isArray(photos) ? photos : [],
            isPrivate: isPrivate ?? false,
            author: { connect: { id: userId } },
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

    if (!complaint) {
      return { error: "Failed to generate unique tracking number" };
    }

    await createAuditLog({
      entityType: "Complaint",
      entityId: complaint.id,
      action: "CREATE",
      userId,
      newValue: {
        trackingNumber: complaint.trackingNumber,
        category,
        description,
        isPrivate: isPrivate ?? false,
      },
    });

    revalidatePath("/complaints");
    return { success: true };
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export async function updateComplaintStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return { error: "Forbidden" };
    }

    if (!Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
      return { error: "Invalid status" };
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, status: true, authorId: true, trackingNumber: true, buildingId: true },
    });

    if (!complaint || complaint.buildingId !== buildingId) {
      return { error: "Complaint not found" };
    }

    const oldStatus = complaint.status;

    await prisma.complaint.update({
      where: { id },
      data: { status: status as ComplaintStatus },
    });

    await createAuditLog({
      entityType: "Complaint",
      entityId: id,
      action: "UPDATE",
      userId,
      oldValue: { status: oldStatus },
      newValue: { status },
    });

    if (oldStatus !== status) {
      await notify({
        userIds: [complaint.authorId],
        type: NotificationType.COMPLAINT_STATUS,
        title: "Complaint Status Updated",
        body: `Your complaint ${complaint.trackingNumber} status changed from ${oldStatus} to ${status}`,
        entityType: "Complaint",
        entityId: id,
      });
    }

    revalidatePath("/complaints");
    return { success: true };
  } catch (error) {
    console.error("Failed to update complaint status:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
