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
  majorityType?: string;
  quorumRequired?: number; // @deprecated
  deadline: string;
  meetingId?: string;
  options: { label: string }[];
}

export async function createVote(input: CreateVoteInput): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    await requireRole(role, "BOARD_MEMBER");
    await requireFeature(buildingId, "voting");

    const { title, description, voteType, isSecret, majorityType, quorumRequired, deadline, meetingId, options } = input;

    if (!title || !deadline || !options || options.length < 2) {
      return { error: "Missing required fields: title, deadline, and at least 2 options" };
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate <= new Date()) {
      return { error: "Deadline must be in the future" };
    }

    const vote = await prisma.vote.create({
      data: {
        title,
        description: description || null,
        voteType: voteType as never,
        status: "OPEN",
        isSecret: isSecret ?? false,
        majorityType: (majorityType as never) ?? "SIMPLE_MAJORITY",
        quorumRequired: new Prisma.Decimal(quorumRequired ?? 0.51), // @deprecated
        deadline: deadlineDate,
        building: { connect: { id: buildingId } },
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
      buildingId,
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
      buildingId,
      newValue: { minutesLength: minutes.length },
    });

    revalidatePath(`/voting/meetings/${meetingId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to save minutes:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export type MinutesSignatureRoleInput =
  | "CHAIR"
  | "AUTHENTICATOR_1"
  | "AUTHENTICATOR_2";

/**
 * Claim a signature slot on a meeting's jegyzőkönyv. Tht. § 39 wants
 * three signatures (chair + two hitelesítő); each row enforces one
 * sign-per-role. Any board member can claim any open slot, but no
 * single user can hold more than one slot per meeting.
 */
export async function signMeetingMinutes(
  meetingId: string,
  signatureRole: MinutesSignatureRoleInput,
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

    const existingByUser = await prisma.meetingMinutesSignature.findFirst({
      where: { meetingId, signerId: userId },
    });
    if (existingByUser) {
      return { error: "Ön már aláírta a jegyzőkönyvet egy másik szerepben." };
    }

    try {
      await prisma.meetingMinutesSignature.create({
        data: {
          meetingId,
          signerId: userId,
          role: signatureRole,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        return { error: "Ezt a szerepet már aláírta valaki más." };
      }
      throw err;
    }

    await createAuditLog({
      entityType: "MeetingMinutesSignature",
      entityId: meetingId,
      action: "CREATE",
      userId,
      buildingId,
      newValue: { role: signatureRole },
    });

    revalidatePath(`/voting/meetings/${meetingId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to sign minutes:", error);
    return {
      error:
        error instanceof Error ? error.message : "Internal server error",
    };
  }
}
