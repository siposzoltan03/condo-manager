"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-gate";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface CreateVoteInput {
  title: string;
  description?: string;
  voteType: string;
  isSecret?: boolean;
  quorumRequired: number;
  deadline: string;
  meetingId?: string;
  options: { label: string }[];
}

export async function createVote(input: CreateVoteInput): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "BOARD_MEMBER");
    await requireFeature(buildingId, "voting");

    const { title, description, voteType, isSecret, quorumRequired, deadline, meetingId, options } = input;

    if (!title || !deadline || !options || options.length < 2) {
      return { error: "Missing required fields: title, deadline, and at least 2 options" };
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return { error: "Deadline must be in the future" };
    }

    if (quorumRequired < 0 || quorumRequired > 1) {
      return { error: "Quorum must be between 0 and 1" };
    }

    const vote = await prisma.vote.create({
      data: {
        title,
        description: description || null,
        voteType: voteType as never,
        isSecret: isSecret ?? false,
        quorumRequired: new Prisma.Decimal(quorumRequired),
        deadline: deadlineDate,
        createdBy: { connect: { id: userId } },
        meeting: meetingId ? { connect: { id: meetingId } } : undefined,
        options: {
          create: options.map((opt, idx) => ({
            label: opt.label,
            sortOrder: idx,
          })),
        },
      },
    });

    await createAuditLog({
      entityType: "Vote",
      entityId: vote.id,
      action: "CREATE",
      userId,
      newValue: { title, voteType, deadline, optionCount: options.length },
    });

    // Notify building users
    const buildingUsers = await prisma.userBuilding.findMany({
      where: { buildingId, userId: { not: userId } },
      select: { userId: true },
    });

    if (buildingUsers.length > 0) {
      await notify({
        userIds: buildingUsers.map((u) => u.userId),
        type: NotificationType.VOTE_OPEN,
        title: "New Vote",
        body: title,
        entityType: "Vote",
        entityId: vote.id,
      });
    }

    revalidatePath("/voting");
    return { success: true };
  } catch (error) {
    console.error("Failed to create vote:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export async function saveMinutes(
  meetingId: string,
  minutes: string
): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "BOARD_MEMBER");
    await requireFeature(buildingId, "voting");

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, buildingId: true },
    });

    if (!meeting || meeting.buildingId !== buildingId) {
      return { error: "Meeting not found" };
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        minutes,
        minutesUpdatedAt: new Date(),
        minutesUpdatedById: userId,
      },
    });

    await createAuditLog({
      entityType: "Meeting",
      entityId: meetingId,
      action: "UPDATE",
      userId,
      newValue: { minutesLength: minutes.length },
    });

    revalidatePath(`/voting/meetings/${meetingId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to save minutes:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
