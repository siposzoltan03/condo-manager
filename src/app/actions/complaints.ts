"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { requireNotFrozen } from "@/lib/frozen-check";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma, ComplaintStatus } from "@prisma/client";
import { ALLOWED_TRANSITIONS } from "@/lib/complaint-transitions";

interface ActionResult {
  success?: boolean;
  error?: string;
  id?: string;
}

interface CreateComplaintInput {
  categoryId: string;
  title?: string;
  description: string;
  photos?: { name: string; url: string; size?: number }[];
  isPrivate?: boolean;
  respondentUnitId?: string;
}

export async function createComplaint(
  input: CreateComplaintInput,
): Promise<ActionResult> {
  try {
    const { userId, buildingId } = await requireBuildingContext();
    await requireNotFrozen(buildingId);

    const { categoryId, title, description, photos, isPrivate, respondentUnitId } =
      input;

    if (!categoryId || !description?.trim()) {
      return { error: "Missing required fields: categoryId, description" };
    }

    // Verify category belongs to this building and is active.
    const category = await prisma.complaintCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, buildingId: true, isActive: true },
    });
    if (!category || category.buildingId !== buildingId || !category.isActive) {
      return { error: "Invalid category" };
    }

    // Verify respondent unit (if provided) belongs to this building.
    if (respondentUnitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: respondentUnitId },
        select: { buildingId: true },
      });
      if (!unit || unit.buildingId !== buildingId) {
        return { error: "Invalid respondent unit" };
      }
    }

    // Generate tracking number with retry on collision.
    const MAX_RETRIES = 5;
    let complaint:
      | Awaited<ReturnType<typeof prisma.complaint.create>>
      | null = null;

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
            title: title?.trim() || null,
            description,
            photos: photos ?? [],
            isPrivate: isPrivate ?? true,
            author: { connect: { id: userId } },
            building: { connect: { id: buildingId } },
            category: { connect: { id: categoryId } },
            ...(respondentUnitId
              ? { respondentUnit: { connect: { id: respondentUnitId } } }
              : {}),
            statusEvents: {
              create: {
                fromStatus: null,
                toStatus: ComplaintStatus.REPORTED,
                actorId: userId,
              },
            },
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
      buildingId,
      newValue: {
        trackingNumber: complaint.trackingNumber,
        categoryId,
        title: title ?? null,
        description,
        isPrivate: isPrivate ?? true,
        respondentUnitId: respondentUnitId ?? null,
      },
    });

    revalidatePath("/complaints");
    return { success: true, id: complaint.id };
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}

export interface NewMeetingInput {
  title: string;
  /** ISO date string (YYYY-MM-DD or full ISO). */
  date: string;
  /** "HH:mm" 24h. */
  time: string;
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  note?: string,
  escalatedMeetingId?: string,
  newMeeting?: NewMeetingInput,
): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    if (!allows(ctx, "board.manage")) {
      return { error: "Forbidden" };
    }

    if (!Object.values(ComplaintStatus).includes(status)) {
      return { error: "Invalid status" };
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        authorId: true,
        trackingNumber: true,
        buildingId: true,
        title: true,
        description: true,
      },
    });

    if (!complaint || complaint.buildingId !== buildingId) {
      return { error: "Complaint not found" };
    }

    if (complaint.status === status) {
      return { error: "Already in that status" };
    }

    const allowed = ALLOWED_TRANSITIONS[complaint.status] ?? [];
    if (!allowed.includes(status)) {
      return {
        error: `Cannot transition from ${complaint.status} to ${status}`,
      };
    }

    // Validate the optional meeting link on ESCALATED. An escalation may
    // also be queued without a meeting — the board picks one later from
    // the pending-agenda inbox.
    if (status === "ESCALATED") {
      if (escalatedMeetingId) {
        const meeting = await prisma.meeting.findUnique({
          where: { id: escalatedMeetingId },
          select: { buildingId: true },
        });
        if (!meeting || meeting.buildingId !== buildingId) {
          return { error: "Invalid meeting" };
        }
      }
      if (newMeeting) {
        if (!newMeeting.title?.trim() || !newMeeting.date || !newMeeting.time) {
          return { error: "New meeting requires title, date and time" };
        }
        const parsedDate = new Date(newMeeting.date);
        if (Number.isNaN(parsedDate.getTime())) {
          return { error: "Invalid meeting date" };
        }
        if (!/^\d{2}:\d{2}$/.test(newMeeting.time)) {
          return { error: "Invalid meeting time format (HH:mm)" };
        }
      }
    }

    const oldStatus = complaint.status;

    // Create the new meeting (if requested) outside the $transaction so the
    // Meeting row is the source of truth even if a downstream step fails.
    let resolvedMeetingId = escalatedMeetingId;
    if (status === "ESCALATED" && newMeeting) {
      const created = await prisma.meeting.create({
        data: {
          title: newMeeting.title.trim(),
          date: new Date(newMeeting.date),
          time: newMeeting.time,
          createdById: userId,
          buildingId,
          agenda: [
            `Eszkalált házirend-megsértési ügy: ${complaint.trackingNumber}`,
          ],
        },
        select: { id: true },
      });
      resolvedMeetingId = created.id;
    }

    await prisma.$transaction([
      prisma.complaint.update({
        where: { id },
        data: { status },
      }),
      prisma.complaintStatusEvent.create({
        data: {
          complaintId: id,
          fromStatus: oldStatus,
          toStatus: status,
          actorId: userId,
          note: note?.trim() || null,
        },
      }),
    ]);

    // Manage the PendingAgendaItem for this complaint. Done outside the
    // transaction because upsert + deleteMany have different shapes that
    // Prisma's array-form $transaction can't unify.
    if (status === "ESCALATED") {
      await prisma.pendingAgendaItem.upsert({
        where: { complaintId: id },
        create: {
          buildingId,
          kind: "COMPLAINT_ESCALATION",
          title: complaint.title ?? complaint.trackingNumber,
          description: complaint.description.slice(0, 280),
          complaintId: id,
          createdById: userId,
          attachedMeetingId: resolvedMeetingId ?? null,
        },
        update: {
          attachedMeetingId: resolvedMeetingId ?? null,
        },
      });
    } else if (oldStatus === "ESCALATED") {
      // Withdrawing from escalation — drop the queue entry.
      await prisma.pendingAgendaItem.deleteMany({
        where: { complaintId: id },
      });
    }

    await createAuditLog({
      entityType: "Complaint",
      entityId: id,
      action: "UPDATE",
      userId,
      buildingId,
      oldValue: { status: oldStatus },
      newValue: {
        status,
        note: note ?? null,
        escalatedMeetingId: resolvedMeetingId ?? null,
        newMeeting: newMeeting ?? null,
      },
    });

    await notify({
      userIds: [complaint.authorId],
      type: NotificationType.COMPLAINT_STATUS,
      title: "Panasz státusza frissült",
      body: `${complaint.trackingNumber}: ${oldStatus} → ${status}`,
      entityType: "Complaint",
      entityId: id,
    });

    revalidatePath("/complaints");
    revalidatePath(`/complaints/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update complaint status:", error);
    return { error: error instanceof Error ? error.message : "Internal server error" };
  }
}
