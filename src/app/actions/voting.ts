"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { requireFeature } from "@/lib/feature-gate";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sealMinutes as sealMinutesContent } from "@/lib/voting/minutes-integrity";
import {
  recordMinutesBoardPosting,
  queueMinutesEmailDeliveries,
} from "@/lib/voting/minutes-delivery";

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
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    requireCapability(ctx, "vote.start");
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

    revalidatePath("/[locale]/voting", "page");
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
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    requireCapability(ctx, "vote.editMinutes");
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

    revalidatePath("/[locale]/voting/meetings/[id]", "page");
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
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    requireCapability(ctx, "vote.editMinutes");
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

    revalidatePath("/[locale]/voting/meetings/[id]", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to sign minutes:", error);
    return {
      error:
        error instanceof Error ? error.message : "Internal server error",
    };
  }
}

const REQUIRED_SIGNATURE_ROLES = ["CHAIR", "AUTHENTICATOR_1", "AUTHENTICATOR_2"] as const;

/**
 * Seal the executed jegyzőkönyv: freeze a content-hash into an immutable
 * MeetingMinutesVersion (tamper-evidence). Requires the minutes narrative +
 * all three Tht. § 39 signatures. Re-sealing after a correction bumps the
 * version. vote.editMinutes-gated + audited.
 */
export async function sealMeetingMinutes(meetingId: string): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    requireCapability(ctx, "vote.editMinutes");
    await requireFeature(buildingId, "voting");

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, buildingId: true, minutes: true },
    });
    if (!meeting || meeting.buildingId !== buildingId) {
      return { error: "Meeting not found" };
    }
    if (!meeting.minutes || meeting.minutes.trim().length === 0) {
      return { error: "A jegyzőkönyv szövege üres — előbb töltsd ki." };
    }

    const signatures = await prisma.meetingMinutesSignature.findMany({
      where: { meetingId },
      select: { role: true },
    });
    const roles = new Set(signatures.map((s) => s.role));
    const missing = REQUIRED_SIGNATURE_ROLES.filter((r) => !roles.has(r));
    if (missing.length > 0) {
      return { error: "A lezáráshoz mindhárom aláírás szükséges (elnök + két hitelesítő)." };
    }

    const sealed = await sealMinutesContent(prisma, { meetingId, sealedById: userId });
    if (!sealed.alreadySealed) {
      await createAuditLog({
        entityType: "Meeting",
        entityId: meetingId,
        action: "UPDATE",
        userId,
        buildingId,
        newValue: {
          minutesSealed: true,
          version: sealed.versionNumber,
          contentHash: sealed.contentHash,
        },
      });
    }

    revalidatePath("/[locale]/voting/meetings/[id]", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to seal minutes:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

/**
 * Distribute the sealed jegyzőkönyv (Tht. § 43): record the § 43/A noticeboard
 * posting + queue § 33/A per-owner emails. Requires the minutes to be sealed
 * first. vote.editMinutes-gated + audited.
 */
export async function distributeMeetingMinutes(meetingId: string): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    requireCapability(ctx, "vote.editMinutes");
    await requireFeature(buildingId, "voting");

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, buildingId: true },
    });
    if (!meeting || meeting.buildingId !== buildingId) {
      return { error: "Meeting not found" };
    }

    const sealed = await prisma.meetingMinutesVersion.findFirst({
      where: { meetingId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    if (!sealed) {
      return { error: "Előbb zárd le (pecsételd le) a jegyzőkönyvet." };
    }

    await recordMinutesBoardPosting(prisma, meetingId);
    const queued = await queueMinutesEmailDeliveries(prisma, { meetingId, buildingId });

    await createAuditLog({
      entityType: "Meeting",
      entityId: meetingId,
      action: "UPDATE",
      userId,
      buildingId,
      newValue: { minutesDistributed: true, version: sealed.versionNumber, emailsQueued: queued },
    });

    revalidatePath("/[locale]/voting/meetings/[id]", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to distribute minutes:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
