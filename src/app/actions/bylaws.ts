"use server";

import { revalidatePath } from "next/cache";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { MajorityType, CostAllocationBasis } from "@prisma/client";

interface ProposeInput {
  meetingId: string;
  reserveTargetHUF?: number | null;
  defaultMajority?: string | null;
  costAllocationBasis?: string | null;
  /** Required majority of the backing vote (Tht. bylaws changes: qualified). */
  voteMajorityType?: string;
  deadlineISO?: string;
}

interface ActionResult {
  success?: boolean;
  error?: string;
  proposalId?: string;
  voteId?: string;
}

/**
 * Propose a bylaws/governance change. Creates the proposal + a YES/NO
 * közgyűlés vote at a meeting; the change is applied automatically only when
 * that vote closes as passed (resolveBylawsProposal, from the vote-close hook).
 */
export async function proposeBylawsChange(input: ProposeInput): Promise<ActionResult> {
  try {
    const ctx = await requireBuildingContext();
    requireCapability(ctx, "bylaws.modify");

    // Validate the changeset — at least one field, each well-formed.
    const data: {
      reserveTargetHUF?: bigint;
      defaultMajority?: MajorityType;
      costAllocationBasis?: CostAllocationBasis;
    } = {};
    if (input.reserveTargetHUF != null) {
      const n = Number(input.reserveTargetHUF);
      if (!Number.isFinite(n) || n < 0) return { error: "Invalid reserve target." };
      data.reserveTargetHUF = BigInt(Math.round(n));
    }
    if (input.defaultMajority) {
      if (!Object.values(MajorityType).includes(input.defaultMajority as MajorityType)) {
        return { error: "Invalid majority rule." };
      }
      data.defaultMajority = input.defaultMajority as MajorityType;
    }
    if (input.costAllocationBasis) {
      if (!Object.values(CostAllocationBasis).includes(input.costAllocationBasis as CostAllocationBasis)) {
        return { error: "Invalid cost allocation basis." };
      }
      data.costAllocationBasis = input.costAllocationBasis as CostAllocationBasis;
    }
    if (Object.keys(data).length === 0) {
      return { error: "Propose at least one change." };
    }

    const voteMajority: MajorityType =
      input.voteMajorityType && Object.values(MajorityType).includes(input.voteMajorityType as MajorityType)
        ? (input.voteMajorityType as MajorityType)
        : "TWO_THIRDS"; // bylaws default to a qualified majority

    const meeting = await prisma.meeting.findUnique({
      where: { id: input.meetingId },
      select: { id: true, buildingId: true, title: true, date: true },
    });
    if (!meeting || meeting.buildingId !== ctx.buildingId) {
      return { error: "Meeting not found." };
    }

    const deadline = input.deadlineISO ? new Date(input.deadlineISO) : meeting.date;

    const { proposalId, voteId } = await prisma.$transaction(async (tx) => {
      const proposal = await tx.bylawsChangeProposal.create({
        data: {
          buildingId: ctx.buildingId,
          proposedById: ctx.userId,
          reserveTargetHUF: data.reserveTargetHUF,
          defaultMajority: data.defaultMajority,
          costAllocationBasis: data.costAllocationBasis,
        },
      });
      const vote = await tx.vote.create({
        data: {
          title: "SZMSZ / gazdálkodás módosítása",
          voteType: "YES_NO",
          status: "OPEN",
          majorityType: voteMajority,
          quorumRequired: 0.51, // @deprecated column, kept for compatibility
          deadline,
          buildingId: ctx.buildingId,
          meetingId: meeting.id,
          createdById: ctx.userId,
          linkedBylawsProposalId: proposal.id,
          // YES_NO: first option is "Igen" (the yes weight); then Nem/Tartózkodás.
          options: {
            create: [
              { label: "Igen", sortOrder: 0 },
              { label: "Nem", sortOrder: 1 },
              { label: "Tartózkodás", sortOrder: 2 },
            ],
          },
        },
      });
      return { proposalId: proposal.id, voteId: vote.id };
    });

    await createAuditLog({
      entityType: "BylawsChangeProposal",
      entityId: proposalId,
      action: "CREATE",
      userId: ctx.userId,
      buildingId: ctx.buildingId,
      newValue: {
        voteId,
        voteMajority,
        reserveTargetHUF: data.reserveTargetHUF != null ? Number(data.reserveTargetHUF) : undefined,
        defaultMajority: data.defaultMajority,
        costAllocationBasis: data.costAllocationBasis,
      },
    });

    revalidatePath("/voting");
    return { success: true, proposalId, voteId };
  } catch (e) {
    console.error("proposeBylawsChange failed:", e);
    return { error: e instanceof Error ? e.message : "Internal error" };
  }
}
