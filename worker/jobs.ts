import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "./processors/email";
import { sendPush, PushSubscription } from "./processors/push";

const prisma = new PrismaClient();

/**
 * Maps notification type values (as stored in the DB / job data) to the
 * corresponding key in a user's notificationPreferences object.
 * Example prefs shape: { announcements: "email", messages: "push", ... }
 */
const TYPE_TO_PREF_KEY: Record<string, string> = {
  ANNOUNCEMENT_NEW: "announcements",
  MESSAGE_NEW: "messages",
  MAINTENANCE_STATUS: "maintenance",
  PAYMENT_REMINDER: "payments",
  VOTE_OPEN: "voting",
  VOTE_CLOSING: "voting",
  COMPLAINT_STATUS: "complaints",
};

export async function processNotificationJob(job: Job): Promise<void> {
  switch (job.name) {
    case "send-notification": {
      const { userId, type, title, body } = job.data as {
        notificationId: string;
        userId: string;
        type: string;
        title: string;
        body: string;
        entityType?: string;
        entityId?: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, notificationPreferences: true },
      });

      if (!user) {
        console.warn(`User ${userId} not found; skipping notification job.`);
        break;
      }

      const prefs = (user.notificationPreferences ?? {}) as Record<
        string,
        string
      >;
      const prefKey = TYPE_TO_PREF_KEY[type] ?? type;
      const channel: string = prefs[prefKey] ?? "email";

      if (channel === "email" || channel === "both") {
        const htmlBody = `<p>${body}</p>`;
        await sendEmail(user.email, title, htmlBody);
      }

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
