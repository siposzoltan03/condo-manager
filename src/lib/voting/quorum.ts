import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Calculate the current quorum for a vote.
 * Quorum = sum of ballot weights / total ownership shares of all units.
 */
export async function calculateQuorum(voteId: string): Promise<{
  currentQuorum: number;
  totalBallotWeight: number;
  totalOwnershipShares: number;
  ballotCount: number;
}> {
  const [ballots, units] = await Promise.all([
    prisma.ballot.findMany({
      where: { voteId },
      select: { weight: true },
    }),
    prisma.unit.findMany({
      select: { ownershipShare: true },
    }),
  ]);

  const totalBallotWeight = ballots.reduce(
    (sum, b) => sum + Number(b.weight),
    0
  );

  const totalOwnershipShares = units.reduce(
    (sum, u) => sum + Number(u.ownershipShare),
    0
  );

  const currentQuorum =
    totalOwnershipShares > 0 ? totalBallotWeight / totalOwnershipShares : 0;

  return {
    currentQuorum,
    totalBallotWeight,
    totalOwnershipShares,
    ballotCount: ballots.length,
  };
}

/**
 * Calculate vote results (only for closed votes).
 */
export async function calculateResults(voteId: string): Promise<{
  options: Array<{
    id: string;
    label: string;
    votes: number;
    weight: number;
    percentage: number;
  }>;
  totalWeight: number;
  passed: boolean;
}> {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          ballots: { select: { weight: true } },
        },
      },
    },
  });

  if (!vote) throw new Error("Vote not found");

  const totalWeight = vote.options.reduce(
    (sum, opt) =>
      sum +
      opt.ballots.reduce((s, b) => s + Number(b.weight), 0),
    0
  );

  const options = vote.options.map((opt) => {
    const optWeight = opt.ballots.reduce((s, b) => s + Number(b.weight), 0);
    return {
      id: opt.id,
      label: opt.label,
      votes: opt.ballots.length,
      weight: optWeight,
      percentage: totalWeight > 0 ? (optWeight / totalWeight) * 100 : 0,
    };
  });

  // For YES_NO votes, "Yes" (first option) needs > 50% weight to pass
  const passed =
    vote.voteType === "YES_NO" && options.length > 0
      ? options[0].percentage > 50
      : false;

  return { options, totalWeight, passed };
}
