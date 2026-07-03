import type { Job } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import { purgeExpiredUserSessions } from "../../src/lib/retention";
import { eligibleCamerasForPurge } from "../../src/lib/camera-retention";

/**
 * Scheduled retention purge (data-minimisation). Deletes stale login sessions
 * and reports camera footage past its retention window (the footage itself is
 * purged by the storage lifecycle, not here). Deliberately does NOT touch
 * ballots or audit logs — those have a legal retention and are removed only via
 * a separate, audited process.
 */
export async function processRetentionJob(job: Job): Promise<void> {
  const sessions = await purgeExpiredUserSessions(prisma);
  const cameras = await eligibleCamerasForPurge(prisma);
  console.log(
    `[retention] job ${job.id}: purged ${sessions.deleted} stale session(s); ` +
      `${cameras.length} camera(s) have footage past retention (storage lifecycle purges the footage).`,
  );
}
