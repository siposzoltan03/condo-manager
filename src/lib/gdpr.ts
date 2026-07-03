import type { PrismaClient } from "@prisma/client";

/**
 * GDPR data-subject rights (Art. 15 access / Art. 17 erasure).
 *
 * Both helpers take a prisma client (like `retention.ts`) so they can be
 * unit-tested and reused by more than one call-site — the self-service
 * settings flow AND the ADMIN-initiated erasure of a removed resident.
 *
 * Erasure is ANONYMISATION, not row deletion: ledger entries, ballots,
 * assembly minutes and signatures carry a statutory retention (Hungarian
 * accounting law ~8y; assembly records) and must survive. We therefore null
 * the PII on the User row and drop the tombstone, leaving foreign-key
 * references intact but no longer identifying.
 */

/** The name a User row shows once its PII has been erased. */
export const ANONYMIZED_NAME = "Törölt felhasználó";

/** Deterministic, non-identifying replacement email (keeps the UNIQUE ok). */
export function anonymizedEmail(userId: string): string {
  return `deleted-${userId.slice(-8)}@anonymized.local`;
}

/**
 * Build the Art. 15 "everything we hold about you" bundle for a single user.
 * Returns a plain, JSON-serialisable object. Deliberately excludes
 * passwordHash, totpSecret and backup codes (security material, not personal
 * data the subject needs returned). Secret ballots are naturally absent —
 * their `userId` is null by construction, so a self-scoped query can't reach
 * them (secrecy preserved).
 */
export async function buildUserDataExport(
  prisma: Pick<
    PrismaClient,
    | "user"
    | "userBuilding"
    | "unitUser"
    | "proxyAssignment"
    | "meetingRsvp"
    | "complaint"
    | "notification"
    | "userSession"
    | "ballot"
    | "auditLog"
  >,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      language: true,
      phone: true,
      secondaryEmail: true,
      birthDate: true,
      permanentAddress: true,
      mailingAddress: true,
      emailVerifiedAt: true,
      notificationPreferences: true,
      totpEnrolledAt: true,
      deletedAt: true,
      anonymizedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return null;

  const [
    memberships,
    units,
    proxiesGranted,
    proxiesReceived,
    rsvps,
    complaints,
    notifications,
    sessions,
    openBallots,
    auditLogs,
  ] = await Promise.all([
    prisma.userBuilding.findMany({
      where: { userId },
      select: {
        role: true,
        isActive: true,
        isChair: true,
        isProfessional: true,
        createdAt: true,
        building: { select: { id: true, name: true } },
      },
    }),
    prisma.unitUser.findMany({
      where: { userId },
      select: {
        relationship: true,
        isPrimaryContact: true,
        livesAtUnit: true,
        contactConsentAt: true,
        contactConsentMode: true,
        createdAt: true,
        unit: { select: { id: true, number: true, stairwell: true } },
      },
    }),
    prisma.proxyAssignment.findMany({
      where: { grantorId: userId },
      select: { granteeId: true, voteId: true, validFrom: true, validUntil: true, createdAt: true },
    }),
    prisma.proxyAssignment.findMany({
      where: { granteeId: userId },
      select: { grantorId: true, voteId: true, validFrom: true, validUntil: true, createdAt: true },
    }),
    prisma.meetingRsvp.findMany({
      where: { userId },
      select: { meetingId: true, status: true, createdAt: true },
    }),
    prisma.complaint.findMany({
      where: { authorId: userId },
      select: { id: true, title: true, status: true, trackingNumber: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { type: true, title: true, isRead: true, createdAt: true },
    }),
    prisma.userSession.findMany({
      where: { userId },
      // tokenId omitted on purpose — it's an auth secret, not personal data.
      select: {
        userAgent: true,
        ipMasked: true,
        deviceLabel: true,
        city: true,
        country: true,
        createdAt: true,
        lastActiveAt: true,
        revokedAt: true,
      },
    }),
    // Only open-ballot rows carry userId; secret ones are null → excluded.
    prisma.ballot.findMany({
      where: { userId },
      select: { voteId: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      select: { action: true, entityType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    gdprArticle: "Article 15",
    profile: { ...user, twoFactorEnabled: user.totpEnrolledAt != null },
    memberships,
    units,
    proxies: { granted: proxiesGranted, received: proxiesReceived },
    meetingRsvps: rsvps,
    complaints,
    notifications,
    sessions,
    ballots: openBallots,
    activityLog: auditLogs,
  };
}

/**
 * Art. 17 erasure by anonymisation. Nulls all PII on the User row, drops the
 * deletedAt/anonymizedAt tombstone, deactivates every building membership,
 * revokes all sessions + push subscriptions + backup codes, and writes a
 * single DELETE audit row. Foreign-key references (ballots, ledger, minutes)
 * are intentionally left intact for statutory retention.
 *
 * Idempotent-ish: re-running on an already-anonymised user is harmless.
 */
export async function anonymizeUser(
  prisma: Pick<
    PrismaClient,
    | "user"
    | "userBuilding"
    | "pushSubscription"
    | "userSession"
    | "backupCode"
    | "auditLog"
  >,
  userId: string,
  opts: { actorId: string; buildingId?: string; reason?: string; now?: Date },
): Promise<void> {
  const now = opts.now ?? new Date();

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: ANONYMIZED_NAME,
      email: anonymizedEmail(userId),
      phone: null,
      secondaryEmail: null,
      secondaryEmailVerifiedAt: null,
      birthDate: null,
      permanentAddress: null,
      mailingAddress: null,
      emailVerifiedAt: null,
      totpSecret: null,
      totpEnrolledAt: null,
      isActive: false,
      deletedAt: now,
      anonymizedAt: now,
    },
  });

  await prisma.userBuilding.updateMany({
    where: { userId },
    data: { isActive: false },
  });

  // Revoke everything that could re-identify or re-authenticate the user.
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  await prisma.userSession.deleteMany({ where: { userId } });
  await prisma.backupCode.deleteMany({ where: { userId } });

  await prisma.auditLog.create({
    data: {
      entityType: "User",
      entityId: userId,
      action: "DELETE",
      userId: opts.actorId,
      buildingId: opts.buildingId ?? null,
      newValue: {
        anonymized: true,
        self: opts.actorId === userId,
        deletedAt: now.toISOString(),
      },
      reason: opts.reason ?? undefined,
    },
  });
}
