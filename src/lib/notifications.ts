import { prisma } from "@/lib/prisma";
import { notificationsQueue } from "@/lib/queue";

export const NotificationType = {
  ANNOUNCEMENT_NEW: "ANNOUNCEMENT_NEW",
  MESSAGE_NEW: "MESSAGE_NEW",
  MAINTENANCE_STATUS: "MAINTENANCE_STATUS",
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
  VOTE_OPEN: "VOTE_OPEN",
  VOTE_CLOSING: "VOTE_CLOSING",
  COMPLAINT_STATUS: "COMPLAINT_STATUS",
  MEETING_RSVP: "MEETING_RSVP",
  REPORT_READY: "REPORT_READY",
  /** Board-side: contractor placed a bid on a published ticket. */
  MARKETPLACE_NEW_BID: "MARKETPLACE_NEW_BID",
  /** Board-side: contractor wrote in the (anonymous) thread for a bid. */
  MARKETPLACE_MESSAGE_CONTRACTOR: "MARKETPLACE_MESSAGE_CONTRACTOR",
  /** Board-side: 72h elapsed on a publication with zero bids. */
  MARKETPLACE_NO_BIDS_AFTER_72H: "MARKETPLACE_NO_BIDS_AFTER_72H",
  /** Board-side: contractor advanced an awarded project's status. */
  MARKETPLACE_PROJECT_STATUS: "MARKETPLACE_PROJECT_STATUS",
  /** Board-side: contractor submitted an invoice for a completed project. */
  MARKETPLACE_INVOICE_NEW: "MARKETPLACE_INVOICE_NEW",
  /** Contractor-side: their bid won. */
  MARKETPLACE_BID_WON: "MARKETPLACE_BID_WON",
  /** Contractor-side: their bid was not selected. */
  MARKETPLACE_BID_REJECTED: "MARKETPLACE_BID_REJECTED",
  /** Contractor-side: board marked the submitted invoice as paid. */
  MARKETPLACE_INVOICE_PAID: "MARKETPLACE_INVOICE_PAID",
  /** Board-side: board user sent the contractor a message in the thread. */
  MARKETPLACE_MESSAGE_BOARD: "MARKETPLACE_MESSAGE_BOARD",
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];

export type NotificationEventKey =
  | "announcements"
  | "voting"
  | "finance"
  | "maintenance"
  | "comments"
  | "marketplace"
  | "marketing";

/**
 * Map a NotificationType to the user-facing matrix event key. The matrix
 * is what the user toggles on the profile page; we filter recipients here
 * before creating Notification rows. Exported so the worker can use the
 * same mapping when deciding which channel to deliver on.
 */
export function eventKeyFor(
  type: NotificationTypeValue,
): NotificationEventKey {
  switch (type) {
    case "ANNOUNCEMENT_NEW":
      return "announcements";
    case "VOTE_OPEN":
    case "VOTE_CLOSING":
    case "MEETING_RSVP":
      return "voting";
    case "PAYMENT_REMINDER":
      return "finance";
    case "MAINTENANCE_STATUS":
    case "COMPLAINT_STATUS":
      return "maintenance";
    case "MESSAGE_NEW":
      return "comments";
    case "MARKETPLACE_NEW_BID":
    case "MARKETPLACE_MESSAGE_CONTRACTOR":
    case "MARKETPLACE_MESSAGE_BOARD":
    case "MARKETPLACE_NO_BIDS_AFTER_72H":
    case "MARKETPLACE_PROJECT_STATUS":
    case "MARKETPLACE_INVOICE_NEW":
    case "MARKETPLACE_BID_WON":
    case "MARKETPLACE_BID_REJECTED":
    case "MARKETPLACE_INVOICE_PAID":
      return "marketplace";
    case "REPORT_READY":
      // Reports span voting/finance/complaints — bucketing under
      // "announcements" is a catch-all so the user gets pinged unless
      // they've explicitly muted the announcements row.
      return "announcements";
  }
}

/**
 * Read which channels are enabled for a given user + event. The matrix
 * shape is `prefs.matrix.{eventKey}.{channel} = boolean`. Returns an
 * object with each delivery channel's effective on/off state, falling
 * back to "fire on email + push" when prefs are missing.
 */
export function channelsFor(
  prefs: unknown,
  type: NotificationTypeValue,
): { email: boolean; push: boolean; sms: boolean; digest: boolean } {
  const fallback = { email: true, push: true, sms: false, digest: false };
  if (!prefs || typeof prefs !== "object") return fallback;
  const matrix = (prefs as { matrix?: unknown }).matrix;
  if (!matrix || typeof matrix !== "object") return fallback;
  const row = (matrix as Record<string, unknown>)[eventKeyFor(type)];
  if (!row || typeof row !== "object") return fallback;
  const r = row as Record<string, unknown>;
  return {
    email: r.email === true,
    push: r.push === true,
    sms: r.sms === true,
    digest: r.digest === true,
  };
}

/**
 * Returns true if any delivery channel is enabled for this user + event.
 * Default-fire when prefs are missing — that handles brand-new users who
 * haven't visited /settings yet.
 */
async function shouldFire(
  userId: string,
  type: NotificationTypeValue,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const ch = channelsFor(user?.notificationPreferences, type);
  return ch.email || ch.push || ch.sms || ch.digest;
}

async function shouldFireContractor(
  contractorUserId: string,
  type: NotificationTypeValue,
): Promise<boolean> {
  const cu = await prisma.contractorUser.findUnique({
    where: { id: contractorUserId },
    select: { notificationPreferences: true },
  });
  const ch = channelsFor(cu?.notificationPreferences, type);
  return ch.email || ch.push || ch.sms || ch.digest;
}

export interface NotifyInput {
  /** Condo-side recipients (`User.id`). */
  userIds?: string[];
  /** Contractor-side recipients (`ContractorUser.id`). */
  contractorUserIds?: string[];
  type: NotificationTypeValue;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  const {
    userIds = [],
    contractorUserIds = [],
    type,
    title,
    body,
    entityType,
    entityId,
  } = input;

  if (userIds.length === 0 && contractorUserIds.length === 0) return;

  // Filter recipients by their notification matrix. A user that has every
  // channel disabled for this event type is skipped entirely.
  const [condoFire, contractorFire] = await Promise.all([
    Promise.all(
      userIds.map(async (userId) => ({
        userId,
        fire: await shouldFire(userId, type),
      })),
    ),
    Promise.all(
      contractorUserIds.map(async (contractorUserId) => ({
        contractorUserId,
        fire: await shouldFireContractor(contractorUserId, type),
      })),
    ),
  ]);
  const filteredUserIds = condoFire.filter((r) => r.fire).map((r) => r.userId);
  const filteredContractorIds = contractorFire
    .filter((r) => r.fire)
    .map((r) => r.contractorUserId);
  if (filteredUserIds.length === 0 && filteredContractorIds.length === 0) {
    return;
  }

  const createdNotifications = await prisma.$transaction([
    ...filteredUserIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
        },
      }),
    ),
    ...filteredContractorIds.map((contractorUserId) =>
      prisma.notification.create({
        data: {
          contractorUserId,
          type,
          title,
          body,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
        },
      }),
    ),
  ]);

  await Promise.all(
    createdNotifications.map((notification) =>
      notificationsQueue.add(
        "send-notification",
        {
          notificationId: notification.id,
          userId: notification.userId,
          contractorUserId: notification.contractorUserId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          entityType: notification.entityType,
          entityId: notification.entityId,
        },
        { jobId: `notification-${notification.id}` },
      ),
    ),
  );
}

export async function getNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  notifications: object[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}> {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getContractorNotifications(
  contractorUserId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  notifications: object[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}> {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { contractorUserId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { contractorUserId } }),
    prisma.notification.count({
      where: { contractorUserId, isRead: false },
    }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function markContractorAsRead(
  notificationId: string,
  contractorUserId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, contractorUserId },
    data: { isRead: true },
  });
}

export async function markAllContractorAsRead(
  contractorUserId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { contractorUserId, isRead: false },
    data: { isRead: true },
  });
}
