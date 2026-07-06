import type { Job } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import { overdueMinutesMeetings } from "../../src/lib/voting/minutes-delivery";

/**
 * Tht. § 43 — scheduled check for jegyzőkönyv delivery overdue by the 8-day
 * deadline. For each meeting whose minutes have no DELIVERED delivery row 8+
 * days after the assembly, notify the building's manager/board so they can
 * seal + distribute. Idempotent per day: a NOTIFICATION per (meeting, day) is
 * de-duped by title so re-runs don't spam.
 */
export async function processMinutesOverdueJob(job: Job): Promise<void> {
  const overdue = await overdueMinutesMeetings(prisma);
  let notified = 0;

  for (const m of overdue) {
    // Address the building's manager(s)/board (chair first, then ADMIN).
    const officers = await prisma.userBuilding.findMany({
      where: {
        buildingId: m.buildingId,
        isActive: true,
        role: { in: ["ADMIN", "BOARD_MEMBER", "SUPER_ADMIN"] },
      },
      select: { userId: true },
    });

    const title = "Jegyzőkönyv kézbesítése késik";
    const body = `A(z) „${m.title}” közgyűlés jegyzőkönyvének kézbesítése ${m.daysOverdue} napja lejárt (Tht. § 43 – 8 nap). Zárd le és küldd meg a tulajdonosoknak.`;

    for (const o of officers) {
      // De-dupe: skip if an unread overdue notice for this meeting already exists.
      const existing = await prisma.notification.findFirst({
        where: { userId: o.userId, entityType: "Meeting", entityId: m.meetingId, type: "minutes_overdue", isRead: false },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.notification.create({
        data: {
          userId: o.userId,
          type: "minutes_overdue",
          title,
          body,
          entityType: "Meeting",
          entityId: m.meetingId,
        },
      });
      notified++;
    }
  }

  console.log(
    `[minutes-overdue] job ${job.id}: ${overdue.length} meeting(s) past the 8-day ` +
      `delivery deadline; ${notified} notification(s) created.`,
  );
}
