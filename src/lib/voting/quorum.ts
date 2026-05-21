import { prisma } from "@/lib/prisma";
import type { MajorityType } from "@prisma/client";

/**
 * Calculate meeting quorum based on attendance (jelenléti ív).
 * Quorum = sum of present units' ownership shares / total ownership shares.
 * Repeated meetings (megismételt közgyűlés) are always quorate.
 */
export async function calculateMeetingQuorum(meetingId: string): Promise<{
  isQuorate: boolean;
  presentWeight: number;
  totalWeight: number;
  presentPercentage: number;
  presentUnitCount: number;
  totalUnitCount: number;
}> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { buildingId: true, isRepeated: true },
  });

  if (!meeting) {
    return { isQuorate: false, presentWeight: 0, totalWeight: 0, presentPercentage: 0, presentUnitCount: 0, totalUnitCount: 0 };
  }

  const [attendances, units] = await Promise.all([
    prisma.meetingAttendance.findMany({
      where: { meetingId, checkedIn: true, checkedOutAt: null },
      include: { unit: { select: { ownershipShare: true } } },
    }),
    prisma.unit.findMany({
      where: { buildingId: meeting.buildingId },
      select: { ownershipShare: true },
    }),
  ]);

  const presentWeight = attendances.reduce(
    (sum, a) => sum + Number(a.unit.ownershipShare),
    0
  );

  const totalWeight = units.reduce(
    (sum, u) => sum + Number(u.ownershipShare),
    0
  );

  const presentPercentage = totalWeight > 0 ? (presentWeight / totalWeight) * 100 : 0;

  // Repeated meeting: always quorate regardless of attendance
  // First meeting: quorate if present ownership shares > 50% of total
  const isQuorate = meeting.isRepeated ? true : presentPercentage > 50;

  return {
    isQuorate,
    presentWeight,
    totalWeight,
    presentPercentage,
    presentUnitCount: attendances.length,
    totalUnitCount: units.length,
  };
}

/**
 * Calculate vote results with majority-type-aware pass/fail logic.
 * Replaces the old calculateQuorum and calculateResults functions.
 *
 * Majority types (Hungarian condo law):
 * - SIMPLE_MAJORITY: >50% of present members' cast votes (abstentions excluded from denominator)
 * - TWO_THIRDS: ≥2/3 of ALL ownership shares must vote yes
 * - FOUR_FIFTHS: ≥4/5 of ALL ownership shares must vote yes
 * - UNANIMOUS: 100% of ALL ownership shares must vote yes
 * - PLURALITY: option with the most weight wins
 */
export async function calculateVoteResult(voteId: string): Promise<{
  options: Array<{
    id: string;
    label: string;
    votes: number;
    weight: number;
    percentage: number;
  }>;
  totalWeight: number;
  effectiveWeight: number;
  majorityType: MajorityType;
  passed: boolean;
  winningOptionId: string | null;
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
      building: {
        include: {
          units: { select: { ownershipShare: true } },
        },
      },
    },
  });

  if (!vote) throw new Error("Vote not found");

  const totalBuildingShares = vote.building.units.reduce(
    (sum, u) => sum + Number(u.ownershipShare),
    0
  );

  const options = vote.options.map((opt) => {
    const optWeight = opt.ballots.reduce((s, b) => s + Number(b.weight), 0);
    return {
      id: opt.id,
      label: opt.label,
      votes: opt.ballots.length,
      weight: optWeight,
      percentage: 0, // calculated below
    };
  });

  // Total weight of all cast ballots
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);

  // Identify abstain option (for SIMPLE_MAJORITY)
  const abstainLabels = ["abstain", "tartózkodom", "tartózkodás", "tartózkodik"];
  const abstainOption = options.find((opt) =>
    abstainLabels.includes(opt.label.toLowerCase())
  );
  const abstainWeight = abstainOption?.weight ?? 0;

  // Effective weight = denominator for percentage calculation
  // For SIMPLE_MAJORITY: exclude abstentions
  // For qualified majorities: total building shares
  let effectiveWeight: number;
  switch (vote.majorityType) {
    case "TWO_THIRDS":
    case "FOUR_FIFTHS":
    case "UNANIMOUS":
      effectiveWeight = totalBuildingShares;
      break;
    case "SIMPLE_MAJORITY":
    case "PLURALITY":
    default:
      effectiveWeight = totalWeight - abstainWeight;
      break;
  }

  // Calculate percentages based on effective weight
  for (const opt of options) {
    opt.percentage = effectiveWeight > 0 ? (opt.weight / effectiveWeight) * 100 : 0;
  }

  // Determine if the vote passed
  let passed = false;
  let winningOptionId: string | null = null;

  if (options.length === 0) {
    passed = false;
  } else if (vote.majorityType === "PLURALITY") {
    // Most weight wins
    const sorted = [...options].sort((a, b) => b.weight - a.weight);
    if (sorted[0].weight > 0) {
      winningOptionId = sorted[0].id;
      passed = true;
    }
  } else if (vote.voteType === "YES_NO" && options.length > 0) {
    // For YES_NO votes, the first option is "Yes"/"Igen"
    const yesWeight = options[0].weight;

    switch (vote.majorityType) {
      case "SIMPLE_MAJORITY":
        // >50% of cast votes excluding abstentions
        passed = effectiveWeight > 0 && yesWeight / effectiveWeight > 0.5;
        break;
      case "TWO_THIRDS":
        // ≥2/3 of ALL ownership shares
        passed = totalBuildingShares > 0 && yesWeight / totalBuildingShares >= 2 / 3;
        break;
      case "FOUR_FIFTHS":
        // ≥4/5 of ALL ownership shares
        passed = totalBuildingShares > 0 && yesWeight / totalBuildingShares >= 4 / 5;
        break;
      case "UNANIMOUS":
        // 100% of ALL ownership shares must vote yes
        passed = totalBuildingShares > 0 && Math.abs(yesWeight - totalBuildingShares) < 0.0001;
        break;
    }

    if (passed) {
      winningOptionId = options[0].id;
    }
  }

  return {
    options,
    totalWeight,
    effectiveWeight,
    majorityType: vote.majorityType,
    passed,
    winningOptionId,
  };
}

// ─── Backwards-compatible wrappers (to be removed after migration) ──────────

/** @deprecated Use calculateMeetingQuorum instead */
export async function calculateQuorum(voteId: string): Promise<{
  currentQuorum: number;
  totalBallotWeight: number;
  totalOwnershipShares: number;
  ballotCount: number;
}> {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId },
    select: { buildingId: true },
  });

  if (!vote) {
    return { currentQuorum: 0, totalBallotWeight: 0, totalOwnershipShares: 0, ballotCount: 0 };
  }

  const [ballots, units] = await Promise.all([
    prisma.ballot.findMany({
      where: { voteId },
      select: { weight: true },
    }),
    prisma.unit.findMany({
      where: { buildingId: vote.buildingId },
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

/** @deprecated Use calculateVoteResult instead */
export async function calculateResults(voteId: string) {
  const result = await calculateVoteResult(voteId);
  return {
    options: result.options,
    totalWeight: result.totalWeight,
    passed: result.passed,
  };
}
