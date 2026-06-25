import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";

/**
 * Complaints domain events. Wraps notify calls for note-add side effects.
 * Audit is not wired on this surface today — add a `createAuditLog`
 * call here when the policy decision lands.
 */

export async function complaintCreated(opts: {
  complaintId: string;
  trackingNumber: string;
  authorUserId: string;
  buildingId: string;
  categoryId: string;
  title: string | null;
  description: string;
  isPrivate: boolean;
  respondentUnitId: string | null;
}) {
  await createAuditLog({
    entityType: "Complaint",
    entityId: opts.complaintId,
    action: "CREATE",
    userId: opts.authorUserId,
    buildingId: opts.buildingId,
    newValue: {
      trackingNumber: opts.trackingNumber,
      categoryId: opts.categoryId,
      title: opts.title,
      description: opts.description,
      isPrivate: opts.isPrivate,
      respondentUnitId: opts.respondentUnitId,
    },
  });
}

export async function complaintNoteAddedByOther(opts: {
  complaintId: string;
  trackingNumber: string;
  authorUserId: string;
}) {
  await notify({
    userIds: [opts.authorUserId],
    type: NotificationType.COMPLAINT_STATUS,
    title: "New Note on Your Complaint",
    body: `A new note was added to your complaint ${opts.trackingNumber}`,
    entityType: "Complaint",
    entityId: opts.complaintId,
  });
}

export async function complaintNoteAddedByAuthor(opts: {
  complaintId: string;
  trackingNumber: string;
  boardMemberUserIds: string[];
}) {
  if (opts.boardMemberUserIds.length === 0) return;
  await notify({
    userIds: opts.boardMemberUserIds,
    type: NotificationType.COMPLAINT_STATUS,
    title: "New Note on Complaint",
    body: `A new note was added to complaint ${opts.trackingNumber}`,
    entityType: "Complaint",
    entityId: opts.complaintId,
  });
}
