import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "./processors/email";

const prisma = new PrismaClient();

export async function processNotificationJob(job: Job): Promise<void> {
  switch (job.name) {
    case "send-notification": {
      const { userId, title, body } = job.data as {
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
      const channel: string = prefs.channel ?? "email";

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

    case "send-push":
      // Push notifications handled separately via push processor
      console.log("Push notification job received:", job.data);
      break;

    default:
      console.warn(`Unknown job type: ${job.name}`);
  }
}
