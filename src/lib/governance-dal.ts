import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";

export interface GovernanceProposal {
  id: string;
  status: string;
  reserveTargetHUF: number | null;
  defaultMajority: string | null;
  costAllocationBasis: string | null;
  voteId: string | null;
  voteStatus: string | null;
  createdAt: string;
}

export interface GovernanceOverview {
  reserveTargetHUF: number;
  defaultMajority: string;
  costAllocationBasis: string;
  /** Whether the viewer may propose a change (bylaws.modify). */
  canPropose: boolean;
  /** Upcoming meetings a proposal's vote can be attached to. */
  upcomingMeetings: { id: string; title: string; date: string }[];
  proposals: GovernanceProposal[];
}

/**
 * Governance / bylaws overview: the building's current settings, whether the
 * viewer can propose a change, upcoming meetings to attach the backing vote to,
 * and the history of change proposals with their status.
 */
export const getGovernanceOverview = cache(
  async (): Promise<GovernanceOverview> => {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    const canPropose = allows(ctx, "bylaws.modify");
    const now = new Date();

    const [building, meetings, proposals] = await Promise.all([
      prisma.building.findUnique({
        where: { id: buildingId },
        select: {
          reserveTargetHUF: true,
          defaultMajority: true,
          costAllocationBasis: true,
        },
      }),
      prisma.meeting.findMany({
        where: { buildingId, date: { gte: now } },
        orderBy: { date: "asc" },
        select: { id: true, title: true, date: true },
        take: 20,
      }),
      prisma.bylawsChangeProposal.findMany({
        where: { buildingId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { vote: { select: { id: true, status: true } } },
      }),
    ]);

    return {
      reserveTargetHUF: Number(building?.reserveTargetHUF ?? 0),
      defaultMajority: building?.defaultMajority ?? "SIMPLE_MAJORITY",
      costAllocationBasis: building?.costAllocationBasis ?? "OWNERSHIP_SHARE",
      canPropose,
      upcomingMeetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date.toISOString(),
      })),
      proposals: proposals.map((p) => ({
        id: p.id,
        status: p.status,
        reserveTargetHUF: p.reserveTargetHUF != null ? Number(p.reserveTargetHUF) : null,
        defaultMajority: p.defaultMajority,
        costAllocationBasis: p.costAllocationBasis,
        voteId: p.vote?.id ?? null,
        voteStatus: p.vote?.status ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  },
);
