import type { PrismaClient } from "@prisma/client";
import { mayExposeContactData } from "@/lib/tenant-consent";

/**
 * Phase 5 — Tht. § 33/A, § 40(3), § 43/A: delivery-proof recording for
 * building announcements. The compliance question is: did the building
 * legally deliver the announcement to each owner?
 *
 * - § 43/A — physical noticeboard is still mandatory. Every
 *   announcement must record at least one PHYSICAL_BOARD delivery row
 *   (no userId, just the timestamped fact of posting).
 * - § 33/A — email is legally equivalent when at least one DELIVERED
 *   EMAIL row exists for a recipient whose email is on file.
 * - § 40(3) — 8-day deadline: a worker (separate plan) flags messages
 *   with no DELIVERED rows after 8 days from posting.
 */

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

/**
 * Record a PHYSICAL_BOARD delivery row. Call this from the announcement
 * compose flow when the chair confirms they posted the notice on the
 * board (or attaches a photograph). userId is null because § 43/A is
 * not per-recipient — it's the fact-of-posting that matters.
 */
export async function recordPhysicalBoardPosting(
  prisma: Pick<PrismaClient, "announcementDelivery">,
  messageId: string,
): Promise<void> {
  await prisma.announcementDelivery.create({
    data: {
      messageId,
      channel: "PHYSICAL_BOARD",
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });
}

/**
 * Record an EMAIL delivery row. Pass the recipient's userId and the
 * mail-server message-id. Initial status is QUEUED; the mailer worker
 * flips to DELIVERED or FAILED based on the SMTP response.
 */
export async function recordEmailQueued(
  prisma: Pick<PrismaClient, "announcementDelivery">,
  args: { messageId: string; userId: string; externalId?: string },
): Promise<void> {
  await prisma.announcementDelivery.create({
    data: {
      messageId: args.messageId,
      userId: args.userId,
      channel: "EMAIL",
      externalId: args.externalId ?? null,
      status: "QUEUED",
    },
  });
}

/**
 * Phase 5 — fan out QUEUED EMAIL rows for every active building member
 * who is eligible to receive the announcement. The mailer worker picks
 * up QUEUED rows and flips them to DELIVERED/FAILED based on SMTP
 * results; that worker lives outside this app (separate plan).
 *
 * Consent rules (Tht. § 22(2) + GDPR Art. 6):
 *   - OWNER membership → email queued (implicit § 16 basis).
 *   - TENANT membership → email queued only if their primary UnitUser
 *     row has `contactConsentAt` set.
 *   - Non-resident roles (ADMIN, BOARD_MEMBER, AUDITOR) → email queued
 *     when the User row has an email.
 *
 * Returns the number of rows enqueued.
 */
export async function queueEmailDeliveriesForAnnouncement(
  prisma: Pick<PrismaClient, "userBuilding" | "announcementDelivery">,
  args: { messageId: string; buildingId: string },
): Promise<number> {
  const members = await prisma.userBuilding.findMany({
    where: { buildingId: args.buildingId, isActive: true },
    select: {
      userId: true,
      role: true,
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

  const rows: { messageId: string; userId: string; channel: "EMAIL"; status: "QUEUED" }[] = [];
  for (const m of members) {
    if (!m.user.email) continue;
    const primary = m.user.unitUsers[0];
    // Non-resident officers without a UnitUser row are always eligible —
    // they're addressed in their official capacity. Residents must clear
    // the consent gate.
    if (primary && !mayExposeContactData(primary)) continue;
    rows.push({
      messageId: args.messageId,
      userId: m.userId,
      channel: "EMAIL",
      status: "QUEUED",
    });
  }

  if (rows.length === 0) return 0;
  const result = await prisma.announcementDelivery.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Tht. § 33/A — is the announcement legally delivered to this recipient
 * via email? True when at least one DELIVERED EMAIL row exists.
 */
export async function hasLegallyEquivalentEmail(
  prisma: Pick<PrismaClient, "announcementDelivery">,
  messageId: string,
  userId: string,
): Promise<boolean> {
  const count = await prisma.announcementDelivery.count({
    where: {
      messageId,
      userId,
      channel: "EMAIL",
      status: "DELIVERED",
    },
  });
  return count > 0;
}

/**
 * Tht. § 40(3) — has the 8-day deadline expired without any DELIVERED
 * row for this message? Used by the worker job to flag dangerously-late
 * announcements for board attention.
 */
export async function isDeliveryOverdue(
  prisma: Pick<PrismaClient, "channelMessage" | "announcementDelivery">,
  messageId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const message = await prisma.channelMessage.findUnique({
    where: { id: messageId },
    select: { createdAt: true },
  });
  if (!message) return false;
  if (now.getTime() - message.createdAt.getTime() < EIGHT_DAYS_MS) return false;
  const deliveredCount = await prisma.announcementDelivery.count({
    where: { messageId, status: "DELIVERED" },
  });
  return deliveredCount === 0;
}
