"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { requireNotFrozen } from "@/lib/frozen-check";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { TargetAudience } from "@prisma/client";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface CreateAnnouncementInput {
  title: string;
  body: string;
  targetAudience: string;
  attachments?: string[];
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "BOARD_MEMBER");
    await requireNotFrozen(buildingId);

    const { title, body, targetAudience, attachments } = input;

    if (!title || !body) {
      return { error: "Missing required fields: title, body" };
    }

    if (!Object.values(TargetAudience).includes(targetAudience as TargetAudience)) {
      return { error: "Invalid target audience" };
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        body,
        targetAudience: targetAudience as TargetAudience,
        attachments: Array.isArray(attachments) ? attachments : [],
        author: { connect: { id: userId } },
        building: { connect: { id: buildingId } },
      },
    });

    await createAuditLog({
      entityType: "Announcement",
      entityId: announcement.id,
      action: "CREATE",
      userId,
      newValue: { title, targetAudience },
    });

    // Notify building users
    const targetUsers = await prisma.userBuilding.findMany({
      where: { buildingId, userId: { not: userId } },
      select: { userId: true },
    });

    if (targetUsers.length > 0) {
      await notify({
        userIds: targetUsers.map((u) => u.userId),
        type: NotificationType.ANNOUNCEMENT_NEW,
        title: "New Announcement",
        body: title,
        entityType: "Announcement",
        entityId: announcement.id,
      });
    }

    revalidatePath("/announcements");
    return { success: true };
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
