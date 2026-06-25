import type { PrismaClient, BuildingCamera } from "@prisma/client";

/**
 * Phase 5 — Tht. § 25 + NAIH camera retention.
 *
 * NAIH guidance caps footage retention at 15 days for ordinary condo
 * cameras. This module provides:
 *   - `eligibleCamerasForPurge` — driver that returns the cameras
 *     whose retention window has elapsed since `now - retentionDays`.
 *     The actual storage purge (S3 lifecycle / fs delete) is wired
 *     separately in a worker job — out of scope for this commit.
 *   - `recordCameraAccess` — required by § 25 + NAIH: every camera
 *     review must log reviewer + purpose. Call this from any code path
 *     that reads footage on behalf of a user.
 */

export interface PurgeCandidate {
  cameraId: string;
  buildingId: string;
  retentionDays: number;
  /** Cutoff timestamp — footage older than this must be deleted. */
  cutoff: Date;
}

export async function eligibleCamerasForPurge(
  prisma: Pick<PrismaClient, "buildingCamera">,
  now: Date = new Date(),
): Promise<PurgeCandidate[]> {
  const cameras = await prisma.buildingCamera.findMany({
    where: { isActive: true },
    select: {
      id: true,
      buildingId: true,
      retentionDays: true,
    },
  });
  return cameras.map((c: Pick<BuildingCamera, "id" | "buildingId" | "retentionDays">) => ({
    cameraId: c.id,
    buildingId: c.buildingId,
    retentionDays: c.retentionDays,
    cutoff: new Date(now.getTime() - c.retentionDays * 24 * 60 * 60 * 1000),
  }));
}

/**
 * Log a camera footage review (§ 25 mandate). The `reason` field is
 * required — pass the explicit purpose ("incident review 2026-05-19",
 * "police inquiry case #..."). Never store free-form user input here
 * without sanitization.
 */
export async function recordCameraAccess(
  prisma: Pick<PrismaClient, "cameraAccessLog">,
  args: { cameraId: string; reviewerId: string; reason: string },
): Promise<void> {
  await prisma.cameraAccessLog.create({
    data: {
      cameraId: args.cameraId,
      reviewerId: args.reviewerId,
      reason: args.reason,
    },
  });
}
