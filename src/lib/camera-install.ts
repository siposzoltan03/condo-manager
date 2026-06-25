import type { PrismaClient } from "@prisma/client";
import { calculateVoteResult } from "@/lib/voting/quorum";

/**
 * Phase 5 — Tht. § 25 camera install pre-flight.
 *
 * Installing a building camera requires:
 *   1. A passed TWO_THIRDS vote against total ownership shares
 *      (the calculateVoteResult helper enforces the right denominator).
 *      The vote must belong to the same building and be CLOSED.
 *   2. A privacy-notice Document on file for the building. We don't
 *      enforce a stable category key (DocumentCategory.name is per-building
 *      free text), so the caller passes the documentId and we verify it
 *      lives under a category that belongs to the same building. The
 *      legal responsibility for picking the *right* document sits with
 *      the chair who signs the install — the API just verifies a document
 *      was attached.
 *
 * This helper returns a structured reason on failure so the API route
 * can return a meaningful 422 to the caller (and surface it in the UI).
 */

export type CameraInstallCheck =
  | { ok: true }
  | {
      ok: false;
      code:
        | "VOTE_NOT_FOUND"
        | "VOTE_WRONG_BUILDING"
        | "VOTE_NOT_CLOSED"
        | "VOTE_WRONG_MAJORITY"
        | "VOTE_NOT_PASSED"
        | "PRIVACY_NOTICE_NOT_FOUND"
        | "PRIVACY_NOTICE_WRONG_BUILDING";
      message: string;
    };

export async function checkCameraInstallEligibility(
  prisma: Pick<PrismaClient, "vote" | "document">,
  args: {
    buildingId: string;
    voteId: string;
    privacyNoticeDocumentId: string;
  },
): Promise<CameraInstallCheck> {
  const vote = await prisma.vote.findUnique({
    where: { id: args.voteId },
    select: { id: true, buildingId: true, status: true, majorityType: true },
  });
  if (!vote) {
    return {
      ok: false,
      code: "VOTE_NOT_FOUND",
      message: "Referenced vote does not exist.",
    };
  }
  if (vote.buildingId !== args.buildingId) {
    return {
      ok: false,
      code: "VOTE_WRONG_BUILDING",
      message: "Vote belongs to a different building.",
    };
  }
  if (vote.status !== "CLOSED") {
    return {
      ok: false,
      code: "VOTE_NOT_CLOSED",
      message: "Vote is not closed; installation requires a final tally.",
    };
  }
  if (vote.majorityType !== "TWO_THIRDS") {
    return {
      ok: false,
      code: "VOTE_WRONG_MAJORITY",
      message:
        "Tht. § 25 requires a TWO_THIRDS vote against total ownership shares.",
    };
  }

  const result = await calculateVoteResult(args.voteId);
  if (!result.passed) {
    return {
      ok: false,
      code: "VOTE_NOT_PASSED",
      message: "Vote did not reach the required 2/3 of total ownership shares.",
    };
  }

  const doc = await prisma.document.findUnique({
    where: { id: args.privacyNoticeDocumentId },
    select: { id: true, category: { select: { buildingId: true } } },
  });
  if (!doc) {
    return {
      ok: false,
      code: "PRIVACY_NOTICE_NOT_FOUND",
      message: "Privacy-notice document does not exist.",
    };
  }
  if (doc.category.buildingId !== args.buildingId) {
    return {
      ok: false,
      code: "PRIVACY_NOTICE_WRONG_BUILDING",
      message: "Privacy-notice document belongs to a different building.",
    };
  }

  return { ok: true };
}
