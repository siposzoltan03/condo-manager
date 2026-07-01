import { prisma } from "@/lib/prisma";
import { MajorityType, CostAllocationBasis } from "@prisma/client";
import { calculateVoteResult } from "@/lib/voting/quorum";
import { createAuditLog } from "@/lib/audit";

/**
 * Bylaws change via assembly resolution: a governance change is proposed and
 * backed by a közgyűlés vote. This applies the change ONLY when that vote
 * closes as passed (using the vote's majorityType), otherwise marks it
 * rejected. Mirrors resolveAwardVote — called from the vote-close handler.
 * Best-effort: a failure here must not fail the vote close.
 */
export type ResolveBylawsResult =
  | { applied: false; reason: "NOT_BYLAWS_VOTE" | "NOT_PENDING" | "REJECTED" }
  | { applied: true; proposalId: string };

export async function resolveBylawsProposal(
  voteId: string,
  closedByUserId: string,
): Promise<ResolveBylawsResult> {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    select: { id: true, buildingId: true, linkedBylawsProposalId: true },
  });
  if (!vote?.linkedBylawsProposalId) return { applied: false, reason: "NOT_BYLAWS_VOTE" };

  const proposal = await prisma.bylawsChangeProposal.findUnique({
    where: { id: vote.linkedBylawsProposalId },
  });
  if (!proposal || proposal.status !== "PENDING_VOTE") {
    return { applied: false, reason: "NOT_PENDING" };
  }

  const { passed } = await calculateVoteResult(voteId);

  if (!passed) {
    await prisma.bylawsChangeProposal.update({
      where: { id: proposal.id },
      data: { status: "REJECTED" },
    });
    await createAuditLog({
      entityType: "BylawsChangeProposal",
      entityId: proposal.id,
      action: "UPDATE",
      userId: closedByUserId,
      buildingId: vote.buildingId,
      oldValue: { status: "PENDING_VOTE" },
      newValue: { status: "REJECTED" },
    });
    return { applied: false, reason: "REJECTED" };
  }

  // Apply only the fields the proposal actually set.
  const data: {
    reserveTargetHUF?: bigint;
    defaultMajority?: MajorityType;
    costAllocationBasis?: CostAllocationBasis;
  } = {};
  const auditApplied: Record<string, unknown> = {};
  if (proposal.reserveTargetHUF != null) {
    data.reserveTargetHUF = proposal.reserveTargetHUF;
    auditApplied.reserveTargetHUF = Number(proposal.reserveTargetHUF);
  }
  if (proposal.defaultMajority != null) {
    data.defaultMajority = proposal.defaultMajority;
    auditApplied.defaultMajority = proposal.defaultMajority;
  }
  if (proposal.costAllocationBasis != null) {
    data.costAllocationBasis = proposal.costAllocationBasis;
    auditApplied.costAllocationBasis = proposal.costAllocationBasis;
  }

  await prisma.$transaction([
    ...(Object.keys(data).length
      ? [prisma.building.update({ where: { id: vote.buildingId }, data })]
      : []),
    prisma.bylawsChangeProposal.update({
      where: { id: proposal.id },
      data: { status: "APPLIED", appliedAt: new Date() },
    }),
  ]);
  await createAuditLog({
    entityType: "BylawsChangeProposal",
    entityId: proposal.id,
    action: "UPDATE",
    userId: closedByUserId,
    buildingId: vote.buildingId,
    oldValue: { status: "PENDING_VOTE" },
    newValue: { status: "APPLIED", applied: auditApplied },
  });
  return { applied: true, proposalId: proposal.id };
}
