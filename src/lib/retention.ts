import type { PrismaClient } from "@prisma/client";

/**
 * Retention purge drivers (data-minimisation, GDPR Art. 5(1)(e)). Pure-ish
 * functions (take a prisma client) so they can be unit-tested and driven from a
 * scheduled worker.
 *
 * Scope note: this intentionally purges only LOW-RISK, clearly-stale data —
 * expired login sessions. It does NOT auto-delete ballots or audit logs: those
 * carry a legal retention (~5 years) and their removal must be a deliberate,
 * audited process, never an unattended cron. Camera footage is handled by the
 * camera-retention driver + storage lifecycle.
 */

/** Stale-session window. A JWT session's maxAge is 8h; rows idle far longer
 *  than this are dead and safe to remove. */
export const DEFAULT_SESSION_RETENTION_DAYS = 90;

export function sessionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Delete UserSession rows whose last activity is older than the retention
 * window. Returns the number deleted.
 */
export async function purgeExpiredUserSessions(
  prisma: Pick<PrismaClient, "userSession">,
  opts: { now?: Date; olderThanDays?: number } = {},
): Promise<{ deleted: number }> {
  const now = opts.now ?? new Date();
  const days = opts.olderThanDays ?? DEFAULT_SESSION_RETENTION_DAYS;
  const { count } = await prisma.userSession.deleteMany({
    where: { lastActiveAt: { lt: sessionCutoff(now, days) } },
  });
  return { deleted: count };
}
