import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * Jegyzőkönyv (minutes) integrity — a tamper-evident *content* hash of the
 * executed minutes, distinct from the cache version-hash in reports/version-hash.ts.
 *
 * `buildMinutesCanonical` serialises the legally-material content
 * deterministically (narrative + resolutions with per-option weight tallies +
 * attendance + signatures). Sealing freezes a SHA-256 over that string into an
 * immutable MeetingMinutesVersion row; re-sealing after a correction bumps the
 * version. `verifyLatestMinutes` recomputes and compares, so any later edit to
 * the minutes, votes, attendance or signatures is detectable.
 *
 * prisma-param (like retention.ts / gdpr.ts) so it is unit-testable.
 */

type IntegrityClient = Pick<
  PrismaClient,
  "meeting" | "meetingAttendance" | "vote" | "meetingMinutesSignature" | "meetingMinutesVersion"
>;

/** Deterministic serialisation of the minutes' legally-material content. */
export async function buildMinutesCanonical(
  prisma: IntegrityClient,
  meetingId: string,
): Promise<string> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, title: true, date: true, minutes: true, isRepeated: true },
  });
  if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

  const [attendance, votes, signatures] = await Promise.all([
    prisma.meetingAttendance.findMany({
      where: { meetingId, checkedIn: true },
      select: { unitId: true },
    }),
    prisma.vote.findMany({
      where: { meetingId },
      select: {
        id: true,
        status: true,
        options: { select: { id: true }, orderBy: { id: "asc" } },
        ballots: { select: { weight: true, optionId: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.meetingMinutesSignature.findMany({
      where: { meetingId },
      select: { role: true, signerId: true, signedAt: true },
      orderBy: { role: "asc" },
    }),
  ]);

  const attendancePart = attendance
    .map((a) => a.unitId)
    .sort()
    .join(",");

  const votesPart = votes
    .map((v) => {
      const tally = v.options
        .map((o) => {
          const sum = v.ballots
            .filter((b) => b.optionId === o.id)
            .reduce((s, b) => s + Number(b.weight ?? 0), 0);
          return `${o.id}=${sum}`;
        })
        .join(";");
      return `${v.id}|${v.status}|${tally}`;
    })
    .join("\n");

  const sigPart = signatures
    .map((s) => `${s.role}:${s.signerId}:${s.signedAt.toISOString()}`)
    .join(",");

  return [
    `meeting:${meeting.id}`,
    `title:${meeting.title}`,
    `date:${meeting.date.toISOString()}`,
    `repeated:${meeting.isRepeated}`,
    `minutes:${meeting.minutes ?? ""}`,
    `attendance:${attendancePart}`,
    `votes:\n${votesPart}`,
    `sigs:${sigPart}`,
  ].join("\n");
}

/** SHA-256 over the canonical minutes content. */
export async function computeMinutesContentHash(
  prisma: IntegrityClient,
  meetingId: string,
): Promise<string> {
  const canonical = await buildMinutesCanonical(prisma, meetingId);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Seal the current minutes: snapshot the content hash into a new immutable
 * version. Returns the version number + hash. Idempotent-ish: sealing an
 * unchanged jegyzőkönyv would create a new version with the same hash, so
 * callers should short-circuit when the latest version already matches.
 */
export async function sealMinutes(
  prisma: IntegrityClient,
  opts: { meetingId: string; sealedById: string },
): Promise<{ versionNumber: number; contentHash: string; alreadySealed: boolean }> {
  const contentHash = await computeMinutesContentHash(prisma, opts.meetingId);

  const latest = await prisma.meetingMinutesVersion.findFirst({
    where: { meetingId: opts.meetingId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, contentHash: true },
  });
  if (latest && latest.contentHash === contentHash) {
    return { versionNumber: latest.versionNumber, contentHash, alreadySealed: true };
  }

  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  await prisma.meetingMinutesVersion.create({
    data: { meetingId: opts.meetingId, versionNumber, contentHash, sealedById: opts.sealedById },
  });
  return { versionNumber, contentHash, alreadySealed: false };
}

export interface MinutesIntegrityStatus {
  sealed: boolean;
  versionNumber: number | null;
  sealedHash: string | null;
  currentHash: string;
  /** True when the current content still matches the latest sealed hash. */
  matches: boolean;
  sealedAt: Date | null;
}

/** Recompute the current content hash and compare it to the latest sealed one. */
export async function verifyLatestMinutes(
  prisma: IntegrityClient,
  meetingId: string,
): Promise<MinutesIntegrityStatus> {
  const currentHash = await computeMinutesContentHash(prisma, meetingId);
  const latest = await prisma.meetingMinutesVersion.findFirst({
    where: { meetingId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, contentHash: true, sealedAt: true },
  });
  if (!latest) {
    return { sealed: false, versionNumber: null, sealedHash: null, currentHash, matches: false, sealedAt: null };
  }
  return {
    sealed: true,
    versionNumber: latest.versionNumber,
    sealedHash: latest.contentHash,
    currentHash,
    matches: latest.contentHash === currentHash,
    sealedAt: latest.sealedAt,
  };
}
