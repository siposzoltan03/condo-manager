import { Job } from "bullmq";
import { prisma } from "../src/lib/prisma";
import { channelsFor, type NotificationTypeValue } from "../src/lib/notifications";
import { notificationEmail } from "../src/lib/email-templates";
import { sendEmail } from "./processors/email";
import { sendPush, PushSubscription } from "./processors/push";

interface NotificationJobData {
  notificationId: string;
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * Build a deep-link into the app for a given (entityType, entityId). Used
 * as the email's CTA target. Falls back to /notifications when nothing
 * specific maps cleanly.
 */
function actionLinkFor(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
): { href: string; label: string } {
  const base =
    process.env.NEXTAUTH_URL ??
    process.env.BASE_URL ??
    "http://localhost:3000";
  const fallback = { href: `${base}/notifications`, label: "Open notifications" };
  if (!entityType || !entityId) return fallback;
  switch (entityType) {
    case "Vote":
      return { href: `${base}/voting`, label: "Open vote" };
    case "Meeting":
      return { href: `${base}/voting/meetings/${entityId}`, label: "Open meeting" };
    case "Complaint":
      return { href: `${base}/complaints/${entityId}`, label: "Open complaint" };
    case "MaintenanceTicket":
      return { href: `${base}/maintenance/${entityId}`, label: "Open ticket" };
    case "Announcement":
      return { href: `${base}/announcements`, label: "Open announcement" };
    case "GeneratedReport":
      return {
        href: `${base}/api/reports/${entityId}/download`,
        label: "Download PDF",
      };
    default:
      return fallback;
  }
}

export async function processNotificationJob(job: Job): Promise<void> {
  switch (job.name) {
    case "send-notification": {
      const data = job.data as NotificationJobData;
      const { userId, type, title, body, entityType, entityId } = data;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          name: true,
          notificationPreferences: true,
        },
      });

      if (!user) {
        console.warn(`User ${userId} not found; skipping notification job.`);
        break;
      }

      // Resolve channels from the user's matrix prefs. The matrix shape is
      // `prefs.matrix.{eventKey}.{channel} = boolean`; SMS/digest are
      // accepted by the matrix but not yet wired here — silently no-op
      // until those channels exist.
      const channels = channelsFor(user.notificationPreferences, type);

      const action = actionLinkFor(entityType, entityId);

      if (channels.email) {
        const { subject, html } = notificationEmail({
          recipientName: user.name,
          title,
          body,
          actionLink: action.href,
          actionLabel: action.label,
        });
        await sendEmail(user.email, subject, html);
      }

      if (channels.push) {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId },
        });

        await Promise.all(
          subscriptions.map((sub) =>
            sendPush(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              title,
              body,
            ),
          ),
        );
      }

      // sms / digest channels are intentionally not handled yet; the
      // matrix UI exposes them but they require provider integration
      // (Twilio for SMS, a separate cron for digest).
      break;
    }

    case "send-email": {
      const { to, subject, html } = job.data as {
        to: string;
        subject: string;
        html: string;
      };
      await sendEmail(to, subject, html);
      break;
    }

    case "send-push": {
      const { subscription, title, body } = job.data as {
        subscription: PushSubscription;
        title: string;
        body: string;
      };
      await sendPush(subscription, title, body);
      break;
    }

    default:
      console.warn(`Unknown job type: ${job.name}`);
  }
}
