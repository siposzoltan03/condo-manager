import type { PrismaClient } from "@prisma/client";
import { mayExposeContactData } from "@/lib/tenant-consent";

/**
 * Tht. § 43 delivery-proof for the jegyzőkönyv. The közös képviselő must send
 * the minutes/resolutions to every owner within 8 days of the assembly. This
 * mirrors announcement-delivery.ts (§ 33/A / § 43/A):
 *
 *   - PHYSICAL_BOARD — the fact of posting the minutes on the noticeboard
 *     (§ 43/A). No userId; DELIVERED immediately.
 *   - EMAIL — per-owner legal-equivalent delivery (§ 33/A), consent-gated;
 *     QUEUED until a mailer flips it to DELIVERED/FAILED.
 *
 * An overdue worker (processMinutesOverdueJob) flags CLOSED meetings that are
 * past the 8-day deadline with no DELIVERED row.
 */

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

/** Record the PHYSICAL_BOARD posting of the minutes (§ 43/A). */
export async function recordMinutesBoardPosting(
  prisma: Pick<PrismaClient, "minutesDelivery">,
  meetingId: string,
): Promise<void> {
  await prisma.minutesDelivery.create({
    data: {
      meetingId,
      channel: "PHYSICAL_BOARD",
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });
}

/**
 * Fan out QUEUED EMAIL rows for every active member eligible to receive the
 * minutes. Same consent rules as announcements (Tht. § 22(2) + GDPR Art. 6):
 * owners/officers with an email on file are eligible; tenants only with
 * recorded contact consent. Returns the number enqueued.
 */
export async function queueMinutesEmailDeliveries(
  prisma: Pick<PrismaClient, "userBuilding" | "minutesDelivery">,
  args: { meetingId: string; buildingId: string },
): Promise<number> {
  const members = await prisma.userBuilding.findMany({
    where: { buildingId: args.buildingId, isActive: true },
    select: {
      userId: true,
      user: {
        select: {
          email: true,
          unitUsers: {
            where: { unit: { buildingId: args.buildingId } },
            select: { relationship: true, contactConsentAt: true },
          },
        },
      },
    },
  });

  const rows: {
    meetingId: string;
    userId: string;
    channel: "EMAIL";
    status: "QUEUED";
  }[] = [];
  for (const m of members) {
    if (!m.user.email) continue;
    const primary = m.user.unitUsers[0];
    if (primary && !mayExposeContactData(primary)) continue;
    rows.push({ meetingId: args.meetingId, userId: m.userId, channel: "EMAIL", status: "QUEUED" });
  }

  if (rows.length === 0) return 0;
  const result = await prisma.minutesDelivery.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/**
 * Tht. § 43 — has the 8-day deadline passed with no DELIVERED minutes-delivery
 * row for this meeting? Measured from the meeting date.
 */
export async function isMinutesDeliveryOverdue(
  prisma: Pick<PrismaClient, "meeting" | "minutesDelivery">,
  meetingId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { date: true, liveStatus: true },
  });
  if (!meeting) return false;
  if (now.getTime() - meeting.date.getTime() < EIGHT_DAYS_MS) return false;
  const deliveredCount = await prisma.minutesDelivery.count({
    where: { meetingId, status: "DELIVERED" },
  });
  return deliveredCount === 0;
}

export interface OverdueMinutes {
  meetingId: string;
  buildingId: string;
  title: string;
  date: Date;
  daysOverdue: number;
}

/**
 * All meetings whose minutes are overdue for delivery: the assembly was 8+
 * days ago and there is still no DELIVERED minutes-delivery row. Used by the
 * scheduled worker. `sinceDays` bounds the scan so it doesn't walk all history.
 */
export async function overdueMinutesMeetings(
  prisma: Pick<PrismaClient, "meeting">,
  opts: { now?: Date; sinceDays?: number } = {},
): Promise<OverdueMinutes[]> {
  const now = opts.now ?? new Date();
  const sinceDays = opts.sinceDays ?? 120;
  const deadline = new Date(now.getTime() - EIGHT_DAYS_MS);
  const floor = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);

  const meetings = await prisma.meeting.findMany({
    where: {
      date: { lt: deadline, gte: floor },
      minutesDeliveries: { none: { status: "DELIVERED" } },
    },
    select: { id: true, buildingId: true, title: true, date: true },
    orderBy: { date: "asc" },
  });

  return meetings.map((m) => ({
    meetingId: m.id,
    buildingId: m.buildingId,
    title: m.title,
    date: m.date,
    daysOverdue: Math.floor((now.getTime() - m.date.getTime()) / (24 * 60 * 60 * 1000)) - 8,
  }));
}
