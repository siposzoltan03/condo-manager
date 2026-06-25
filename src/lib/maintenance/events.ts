import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";

/**
 * Maintenance domain events — mirror of `lib/marketplace/events.ts`.
 * Wraps audit + notify for board-side ticket transitions. Thin: orchestration
 * (DAL lookups, email composition) stays at the caller.
 */

export async function ticketStatusChanged(opts: {
  ticketId: string;
  buildingId: string;
  updatedByUserId: string;
  reporterUserId: string;
  trackingNumber: string;
  oldStatus: string;
  newStatus: string;
}) {
  await createAuditLog({
    entityType: "MaintenanceTicket",
    entityId: opts.ticketId,
    action: "UPDATE",
    userId: opts.updatedByUserId,
    buildingId: opts.buildingId,
    oldValue: { status: opts.oldStatus },
    newValue: { status: opts.newStatus },
  });

  if (opts.oldStatus !== opts.newStatus) {
    await notify({
      userIds: [opts.reporterUserId],
      type: NotificationType.MAINTENANCE_STATUS,
      title: "Maintenance Ticket Updated",
      body: `Your ticket ${opts.trackingNumber} status changed from ${opts.oldStatus} to ${opts.newStatus}`,
      entityType: "MaintenanceTicket",
      entityId: opts.ticketId,
    });
  }
}
