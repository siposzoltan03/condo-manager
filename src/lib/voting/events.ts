import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";

/**
 * Voting domain events. Thin wrappers around audit + notify for the
 * voting routes. Same pattern as the marketplace / maintenance /
 * complaints / finance events modules.
 */

// ── Vote ─────────────────────────────────────────────────────────────

export async function voteCreated(opts: {
  voteId: string;
  createdByUserId: string;
  buildingId: string;
  title: string;
  voteType: string;
  deadline: Date | string;
  isSecret: boolean;
  description: string | null;
  buildingUserIds: string[];
}) {
  await createAuditLog({
    entityType: "Vote",
    entityId: opts.voteId,
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: {
      title: opts.title,
      voteType: opts.voteType,
      deadline:
        typeof opts.deadline === "string"
          ? opts.deadline
          : opts.deadline.toISOString(),
      isSecret: opts.isSecret,
    },
  });

  if (opts.buildingUserIds.length > 0) {
    await notify({
      userIds: opts.buildingUserIds,
      type: NotificationType.VOTE_OPEN,
      title: `New Vote: ${opts.title}`,
      body: opts.description?.substring(0, 200) ?? opts.title,
      entityType: "Vote",
      entityId: opts.voteId,
    });
  }
}

export async function voteUpdated(opts: {
  voteId: string;
  updatedByUserId: string;
  buildingId: string;
  oldStatus: string;
  newValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Vote",
    entityId: opts.voteId,
    action: "UPDATE",
    userId: opts.updatedByUserId,
    buildingId: opts.buildingId,
    oldValue: { status: opts.oldStatus },
    newValue: opts.newValue,
  });
}

// ── Ballot ───────────────────────────────────────────────────────────

export async function ballotCast(opts: {
  ballotId: string;
  voterUserId: string;
  buildingId: string;
  newValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Ballot",
    entityId: opts.ballotId,
    action: "CREATE",
    userId: opts.voterUserId,
    buildingId: opts.buildingId,
    newValue: opts.newValue,
  });
}

// ── Meeting ──────────────────────────────────────────────────────────

export async function meetingCreated(opts: {
  meetingId: string;
  createdByUserId: string;
  buildingId: string;
  newValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Meeting",
    entityId: opts.meetingId,
    action: "CREATE",
    userId: opts.createdByUserId,
    buildingId: opts.buildingId,
    newValue: opts.newValue,
  });
}

export async function meetingUpdated(opts: {
  meetingId: string;
  updatedByUserId: string;
  buildingId: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Meeting",
    entityId: opts.meetingId,
    action: "UPDATE",
    userId: opts.updatedByUserId,
    buildingId: opts.buildingId,
    oldValue: opts.oldValue,
    newValue: opts.newValue,
  });
}

export async function meetingDeleted(opts: {
  meetingId: string;
  deletedByUserId: string;
  buildingId: string;
  oldValue: Record<string, unknown>;
}) {
  await createAuditLog({
    entityType: "Meeting",
    entityId: opts.meetingId,
    action: "DELETE",
    userId: opts.deletedByUserId,
    buildingId: opts.buildingId,
    oldValue: opts.oldValue,
  });
}

export async function meetingMinutesUpdated(opts: {
  meetingId: string;
  updatedByUserId: string;
  buildingId: string;
}) {
  await createAuditLog({
    entityType: "Meeting",
    entityId: opts.meetingId,
    action: "UPDATE",
    userId: opts.updatedByUserId,
    buildingId: opts.buildingId,
    newValue: { minutesUpdated: true },
  });
}

export async function meetingRsvpChanged(opts: {
  meetingId: string;
  meetingTitle: string;
  meetingCreatorUserId: string;
  rsvpByUserName: string;
  statusLabel: string;
}) {
  await notify({
    userIds: [opts.meetingCreatorUserId],
    type: NotificationType.MEETING_RSVP,
    title: `RSVP: ${opts.meetingTitle}`,
    body: `${opts.rsvpByUserName} is ${opts.statusLabel}.`,
    entityType: "Meeting",
    entityId: opts.meetingId,
  }).catch(() => undefined);
}

// ── Proxy ────────────────────────────────────────────────────────────

export async function proxyGranted(opts: {
  proxyId: string;
  grantorUserId: string;
  granteeId: string;
  voteId: string | null;
}) {
  await createAuditLog({
    entityType: "ProxyAssignment",
    entityId: opts.proxyId,
    action: "CREATE",
    userId: opts.grantorUserId,
    newValue: { granteeId: opts.granteeId, voteId: opts.voteId ?? "general" },
  });
}

export async function proxyRevoked(opts: {
  proxyId: string;
  revokedByUserId: string;
}) {
  await createAuditLog({
    entityType: "ProxyAssignment",
    entityId: opts.proxyId,
    action: "DELETE",
    userId: opts.revokedByUserId,
  });
}
