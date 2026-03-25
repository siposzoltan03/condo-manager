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
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];

export interface NotifyInput {
  userIds: string[];
  type: NotificationTypeValue;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  const { userIds, type, title, body, entityType, entityId } = input;

  if (userIds.length === 0) return;

  const createdNotifications = await prisma.$transaction(
    userIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
        },
      })
    )
  );

  await Promise.all(
    createdNotifications.map((notification) =>
      notificationsQueue.add(
        "send-notification",
        {
          notificationId: notification.id,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          entityType: notification.entityType,
          entityId: notification.entityId,
        },
        { jobId: `notification-${notification.id}` }
      )
    )
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
