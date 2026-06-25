import { notificationsQueue } from "./queue";

/**
 * Queue an email for asynchronous delivery by the worker.
 *
 * This returns as soon as the job is enqueued — the actual SMTP send happens
 * in the worker (worker/processors/email.ts) under the notifications queue's
 * retry policy (3 attempts, exponential backoff). That keeps a slow or failing
 * mail server from blocking (or failing) the request that triggered the email.
 *
 * The signature is unchanged from the old inline sender, so every caller keeps
 * working without modification.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await notificationsQueue.add("send-email", { to, subject, html });
  console.log(`[email] queued -> ${to}: ${subject}`);
}
