"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type {
  NotificationMatrix,
  NotificationEventKey,
  NotificationChannel,
} from "@/lib/profile-dal";

interface ActionResult {
  success?: boolean;
  error?: string;
}

const ALL_EVENT_KEYS: NotificationEventKey[] = [
  "announcements",
  "voting",
  "finance",
  "maintenance",
  "comments",
  "marketing",
];
const ALL_CHANNELS: NotificationChannel[] = ["push", "email", "sms", "digest"];

interface UpdatePersonalInput {
  phone?: string | null;
  secondaryEmail?: string | null;
  birthDate?: string | null;
  permanentAddress?: string | null;
  mailingAddress?: string | null;
}

export async function updatePersonalData(
  input: UpdatePersonalInput,
): Promise<ActionResult> {
  try {
    const { userId } = await requireBuildingContext();

    const data: Record<string, unknown> = {};
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.secondaryEmail !== undefined) {
      data.secondaryEmail = input.secondaryEmail || null;
      data.secondaryEmailVerifiedAt = null;
    }
    if (input.birthDate !== undefined) {
      data.birthDate = input.birthDate ? new Date(input.birthDate) : null;
    }
    if (input.permanentAddress !== undefined) {
      data.permanentAddress = input.permanentAddress || null;
    }
    if (input.mailingAddress !== undefined) {
      data.mailingAddress = input.mailingAddress || null;
    }

    if (Object.keys(data).length === 0) {
      return { error: "No fields to update" };
    }

    await prisma.user.update({ where: { id: userId }, data });
    await createAuditLog({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      userId,
      newValue: data,
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update profile:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}

export async function updateNotificationMatrix(
  matrix: NotificationMatrix,
  quietHours?: { start: string | null; end: string | null },
): Promise<ActionResult> {
  try {
    const { userId } = await requireBuildingContext();

    // Defensive: only persist known event keys / channels.
    const cleaned: NotificationMatrix = ALL_EVENT_KEYS.reduce(
      (acc, ev) => {
        const row = matrix[ev] ?? {};
        acc[ev] = ALL_CHANNELS.reduce(
          (chans, ch) => {
            chans[ch] = row[ch] === true;
            return chans;
          },
          {} as Record<NotificationChannel, boolean>,
        );
        return acc;
      },
      {} as NotificationMatrix,
    );

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    const existing =
      current?.notificationPreferences &&
      typeof current.notificationPreferences === "object"
        ? (current.notificationPreferences as Record<string, unknown>)
        : {};

    const next: Record<string, unknown> = {
      ...existing,
      matrix: cleaned,
    };
    if (quietHours) {
      next.quietHours = {
        start: quietHours.start ?? null,
        end: quietHours.end ?? null,
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: next as never },
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}

// ─── Danger zone ─────────────────────────────────────────────────────────

/** Letiltás (deactivate). Sets isActive=false and audit-logs. Reversible. */
export async function deactivateAccount(): Promise<ActionResult> {
  try {
    const { userId } = await requireBuildingContext();
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    await createAuditLog({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      userId,
      newValue: { isActive: false, reason: "self_deactivate" },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to deactivate:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}

interface ResignationInput {
  reason?: string;
}

/**
 * Submit a board-role resignation. Creates a PENDING resignation record,
 * attaches it to the next scheduled meeting (if any), and adds an obligatory
 * agenda item to that meeting. Role is NOT demoted — that happens when
 * another board member acknowledges the resignation in the meeting.
 */
export async function submitBoardResignation(
  input: ResignationInput = {},
): Promise<ActionResult> {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    if (
      role !== "BOARD_MEMBER" &&
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN"
    ) {
      return { error: "Only board members can resign their role" };
    }

    const ub = await prisma.userBuilding.findUnique({
      where: { userId_buildingId: { userId, buildingId } },
    });
    if (!ub) return { error: "Membership not found" };

    // Reject if already pending.
    const existing = await prisma.boardResignation.findFirst({
      where: { userBuildingId: ub.id, status: "PENDING" },
    });
    if (existing) {
      return { error: "A resignation is already pending" };
    }

    // Find next scheduled meeting for this building so we can pre-attach
    // the new pending-agenda item to it. Board can re-attach later via the
    // meeting form if they prefer a different one.
    const now = new Date();
    const nextMeeting = await prisma.meeting.findFirst({
      where: { buildingId, date: { gte: now } },
      orderBy: { date: "asc" },
      select: { id: true },
    });

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const resignation = await prisma.boardResignation.create({
      data: {
        userBuildingId: ub.id,
        status: "PENDING",
        reason: input.reason ?? null,
        // Mandatory agenda surfacing happens via PendingAgendaItem.
        pendingAgenda: {
          create: {
            buildingId,
            kind: "BOARD_RESIGNATION",
            title: `Képviselői lemondás: ${me?.name ?? "ismeretlen"}`,
            description:
              (input.reason ? `Indok: ${input.reason}\n\n` : "") +
              "Ez a napirendi pont a Tht. szerint kötelezően tárgyalandó. A testület döntsön a lemondás elfogadásáról és új választás kiírásáról.",
            createdById: userId,
            attachedMeetingId: nextMeeting?.id ?? null,
          },
        },
      },
    });

    await createAuditLog({
      entityType: "BoardResignation",
      entityId: resignation.id,
      action: "CREATE",
      userId,
      buildingId,
      newValue: {
        userBuildingId: ub.id,
        meetingId: nextMeeting?.id ?? null,
        reason: input.reason ?? null,
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to submit resignation:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}

/**
 * Soft-delete the account: anonymizes PII (name, email, phone, addresses,
 * birth date) and sets deletedAt + anonymizedAt. Foreign-key references
 * (ledger entries, ballots, comments, signatures) stay intact for the
 * statutory 8-year retention required by Hungarian accounting law.
 */
export async function requestAccountDeletion(): Promise<ActionResult> {
  try {
    const { userId } = await requireBuildingContext();

    // Block if user holds open board mandate without a completed resignation.
    const activeBoard = await prisma.userBuilding.findFirst({
      where: {
        userId,
        isActive: true,
        role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
      },
    });
    if (activeBoard) {
      return {
        error:
          "Active board members must resign their role before deleting the account.",
      };
    }

    const now = new Date();
    const anonEmail = `deleted-${userId.slice(-8)}@anonymized.local`;

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: "Volt lakó",
        email: anonEmail,
        phone: null,
        secondaryEmail: null,
        secondaryEmailVerifiedAt: null,
        birthDate: null,
        permanentAddress: null,
        mailingAddress: null,
        isActive: false,
        deletedAt: now,
        anonymizedAt: now,
      },
    });

    // Deactivate all UserBuilding memberships for this user.
    await prisma.userBuilding.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Revoke all push subscriptions.
    await prisma.pushSubscription.deleteMany({ where: { userId } });

    await createAuditLog({
      entityType: "User",
      entityId: userId,
      action: "DELETE",
      userId,
      newValue: { soft: true, anonymized: true, deletedAt: now.toISOString() },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to delete account:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}
