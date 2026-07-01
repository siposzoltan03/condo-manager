import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Bylaws change via assembly resolution: proposing creates a linked YES/NO
 * vote; the change applies only when that vote closes as passed.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireCapability: vi.fn(), allows: vi.fn(() => true) }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { proposeBylawsChange } = await import("@/app/actions/bylaws");
const { resolveBylawsProposal } = await import("@/lib/voting/bylaws-proposal");

beforeEach(() => ctxMock.mockReset());

async function meetingIn(buildingId: string) {
  const creator = await makeUser({ buildingId, role: "ADMIN" });
  return prisma.meeting.create({
    data: { title: "Közgyűlés", date: new Date(), time: "18:00", buildingId, createdById: creator.id },
  });
}

/** Build a proposal + backing vote + a single-owner (100% share) YES/NO vote,
 *  casting `yes` (or not) so calculateVoteResult can tally it. */
async function proposalWithVote(buildingId: string, opts: { yes: boolean }) {
  const unit = await prisma.unit.create({
    data: { number: "1", floor: 1, size: 50, ownershipShare: 1, buildingId },
  });
  const proposal = await prisma.bylawsChangeProposal.create({
    data: { buildingId, proposedById: "proposer", reserveTargetHUF: BigInt(9_000_000) },
  });
  const vote = await prisma.vote.create({
    data: {
      title: "SZMSZ módosítás",
      voteType: "YES_NO",
      status: "OPEN",
      majorityType: "TWO_THIRDS",
      quorumRequired: 0.51,
      deadline: new Date(Date.now() + 86400000),
      buildingId,
      createdById: (await makeUser({ buildingId, role: "ADMIN" })).id,
      linkedBylawsProposalId: proposal.id,
      options: {
        create: [
          { label: "Igen", sortOrder: 0 },
          { label: "Nem", sortOrder: 1 },
          { label: "Tartózkodás", sortOrder: 2 },
        ],
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  const targetOption = opts.yes ? vote.options[0] : vote.options[1];
  await prisma.ballot.create({
    data: { voteId: vote.id, optionId: targetOption.id, unitId: unit.id, weight: 1 },
  });
  return { proposal, vote };
}

describe("bylaws change — propose", () => {
  it("creates a PENDING_VOTE proposal + a linked YES/NO qualified vote", async () => {
    const { building } = await makeBuilding();
    const meeting = await meetingIn(building.id);
    const proposer = await makeUser({ buildingId: building.id, role: "ADMIN" });
    ctxMock.mockResolvedValue({ userId: proposer.id, buildingId: building.id, role: "ADMIN" });

    const res = await proposeBylawsChange({ meetingId: meeting.id, reserveTargetHUF: 9_000_000 });
    expect(res.success).toBe(true);

    const proposal = await prisma.bylawsChangeProposal.findUnique({ where: { id: res.proposalId! } });
    expect(proposal?.status).toBe("PENDING_VOTE");
    const vote = await prisma.vote.findUnique({ where: { id: res.voteId! }, include: { options: true } });
    expect(vote?.linkedBylawsProposalId).toBe(res.proposalId);
    expect(vote?.majorityType).toBe("TWO_THIRDS");
    expect(vote?.voteType).toBe("YES_NO");
    expect(vote?.options).toHaveLength(3);
  });

  it("rejects an empty changeset", async () => {
    const { building } = await makeBuilding();
    const meeting = await meetingIn(building.id);
    ctxMock.mockResolvedValue({ userId: "u1", buildingId: building.id, role: "ADMIN" });
    const res = await proposeBylawsChange({ meetingId: meeting.id });
    expect(res.error).toMatch(/at least one/i);
  });

  it("rejects a meeting from another building", async () => {
    const { building } = await makeBuilding();
    const other = await makeBuilding({ name: "Other" });
    const meeting = await meetingIn(other.building.id);
    ctxMock.mockResolvedValue({ userId: "u1", buildingId: building.id, role: "ADMIN" });
    const res = await proposeBylawsChange({ meetingId: meeting.id, reserveTargetHUF: 1 });
    expect(res.error).toMatch(/not found/i);
  });
});

describe("bylaws change — resolve on vote close", () => {
  it("applies the change to the building when the vote passes", async () => {
    const { building } = await makeBuilding();
    const { proposal, vote } = await proposalWithVote(building.id, { yes: true });
    const r = await resolveBylawsProposal(vote.id, "closer");
    expect(r.applied).toBe(true);
    const b = await prisma.building.findUnique({ where: { id: building.id } });
    expect(Number(b?.reserveTargetHUF)).toBe(9_000_000);
    const p = await prisma.bylawsChangeProposal.findUnique({ where: { id: proposal.id } });
    expect(p?.status).toBe("APPLIED");
    expect(p?.appliedAt).not.toBeNull();
  });

  it("rejects (no change) when the vote fails the majority", async () => {
    const { building } = await makeBuilding();
    const before = await prisma.building.findUnique({ where: { id: building.id } });
    const { proposal, vote } = await proposalWithVote(building.id, { yes: false });
    const r = await resolveBylawsProposal(vote.id, "closer");
    expect(r.applied).toBe(false);
    const b = await prisma.building.findUnique({ where: { id: building.id } });
    expect(Number(b?.reserveTargetHUF)).toBe(Number(before?.reserveTargetHUF)); // unchanged
    const p = await prisma.bylawsChangeProposal.findUnique({ where: { id: proposal.id } });
    expect(p?.status).toBe("REJECTED");
  });
});
