import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeContractorOrg,
  makeMaintenanceTicket,
  makePublication,
  makeBid,
  makeUser,
} from "../fixtures";

/**
 * Voting-based contractor award. `createAwardVote` turns a publication's open
 * bids into a közgyűlés vote (one option per bid + "Egyik sem"), freezes the
 * publication, and adds an agenda point. `resolveAwardVote` (called when the
 * vote closes) tallies share-weighted ballots and auto-awards the winning bid
 * — or unfreezes the publication on "none"/no-quorum. The winner/loser email
 * dispatch is mocked so we assert the award state machine in isolation.
 */

const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }));
vi.mock("@/lib/marketplace/award-notify", () => ({
  dispatchAwardOutcome: dispatchMock,
}));

const { createAwardVote, resolveAwardVote } = await import(
  "@/lib/marketplace/award-vote"
);

beforeEach(() => dispatchMock.mockReset());

async function makeMeeting(buildingId: string, createdById: string) {
  return prisma.meeting.create({
    data: {
      title: "Q2 közgyűlés",
      date: new Date(Date.now() + 7 * 864e5),
      time: "18:00",
      buildingId,
      createdById,
      agenda: [],
    },
  });
}

let unitSeq = 0;
async function makeUnit(buildingId: string, share: string) {
  return prisma.unit.create({
    data: {
      buildingId,
      number: `U-${++unitSeq}`,
      floor: 1,
      ownershipShare: share,
      size: "50.00",
    },
  });
}

describe("createAwardVote", () => {
  it("builds a PLURALITY vote (bids + none), freezes the publication, adds agenda", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({
      buildingId: building.id,
      title: "Liftfelújítás",
    });
    const pub = await makePublication({ ticketId: ticket.id, buildingId: building.id });
    const { org: pricey } = await makeContractorOrg({ name: "Drága Kft." });
    const { org: cheap } = await makeContractorOrg({ name: "Olcsó Kft." });
    await makeBid({ publicationId: pub.id, bidderOrgId: pricey.id, amount: 2_400_000 });
    await makeBid({ publicationId: pub.id, bidderOrgId: cheap.id, amount: 2_100_000 });
    const user = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const meeting = await makeMeeting(building.id, user.id);

    const res = await createAwardVote({
      publicationId: pub.id,
      meetingId: meeting.id,
      buildingId: building.id,
      createdByUserId: user.id,
    });
    expect(res.ok).toBe(true);

    const vote = await prisma.vote.findFirst({
      where: { linkedPublicationId: pub.id },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    expect(vote?.voteType).toBe("MULTIPLE_CHOICE");
    expect(vote?.majorityType).toBe("PLURALITY");
    expect(vote?.meetingId).toBe(meeting.id);
    // Cheapest bid first, then the auto-added none-option (no bid).
    expect(vote?.options.map((o) => o.label)).toEqual([
      "Olcsó Kft.",
      "Drága Kft.",
      "Egyik sem",
    ]);
    expect(vote?.options[0].bidId).toBeTruthy();
    expect(vote?.options[2].bidId).toBeNull();

    const frozen = await prisma.marketplacePublication.findUnique({
      where: { id: pub.id },
    });
    expect(frozen?.status).toBe("PENDING_VOTE");

    const m = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    const agenda = m?.agenda as Array<Record<string, unknown>>;
    expect(
      agenda.some((it) => it.kind === "award_vote" && it.voteId === vote?.id),
    ).toBe(true);
  });

  it("rejects when the publication has no submitted bids", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({ ticketId: ticket.id, buildingId: building.id });
    const user = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const meeting = await makeMeeting(building.id, user.id);

    const res = await createAwardVote({
      publicationId: pub.id,
      meetingId: meeting.id,
      buildingId: building.id,
      createdByUserId: user.id,
    });
    expect(res).toEqual({ ok: false, reason: "NO_BIDS" });
  });

  it("404s a meeting from another building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({ ticketId: ticket.id, buildingId: building.id });
    const { org } = await makeContractorOrg();
    await makeBid({ publicationId: pub.id, bidderOrgId: org.id });
    const user = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const otherMeeting = await makeMeeting(otherBuilding.id, user.id);

    const res = await createAwardVote({
      publicationId: pub.id,
      meetingId: otherMeeting.id,
      buildingId: building.id,
      createdByUserId: user.id,
    });
    expect(res).toEqual({ ok: false, reason: "MEETING_NOT_FOUND" });
  });
});

/** Scaffold an award vote and return its option ids keyed by purpose. */
async function scaffoldAwardVote(shares: string[]) {
  const { building } = await makeBuilding();
  const ticket = await makeMaintenanceTicket({ buildingId: building.id });
  const pub = await makePublication({ ticketId: ticket.id, buildingId: building.id });
  const { org: a } = await makeContractorOrg({ name: "A Kft." });
  const { org: b } = await makeContractorOrg({ name: "B Kft." });
  const bidA = await makeBid({ publicationId: pub.id, bidderOrgId: a.id, amount: 1_000_000 });
  await makeBid({ publicationId: pub.id, bidderOrgId: b.id, amount: 2_000_000 });
  const user = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
  const meeting = await makeMeeting(building.id, user.id);
  const units = [];
  for (const s of shares) units.push(await makeUnit(building.id, s));

  await createAwardVote({
    publicationId: pub.id,
    meetingId: meeting.id,
    buildingId: building.id,
    createdByUserId: user.id,
  });
  const vote = await prisma.vote.findFirstOrThrow({
    where: { linkedPublicationId: pub.id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  const bidOption = vote.options.find((o) => o.bidId === bidA.id)!;
  const noneOption = vote.options.find((o) => o.bidId === null)!;
  return { building, pub, vote, units, user, bidOption, noneOption, winningBidId: bidA.id };
}

async function castBallot(
  voteId: string,
  optionId: string,
  unitId: string,
  weight: string,
) {
  await prisma.ballot.create({
    data: { voteId, optionId, unitId, weight },
  });
}

describe("resolveAwardVote", () => {
  it("auto-awards the winning bid when quorate", async () => {
    const s = await scaffoldAwardVote(["0.5000", "0.5000"]);
    // Both units (full 100% participation) vote for bid A.
    await castBallot(s.vote.id, s.bidOption.id, s.units[0].id, "0.5000");
    await castBallot(s.vote.id, s.bidOption.id, s.units[1].id, "0.5000");

    const res = await resolveAwardVote(s.vote.id, s.user.id);
    expect(res).toEqual({ awarded: true, bidId: s.winningBidId });
    expect(dispatchMock).toHaveBeenCalledOnce();

    const pub = await prisma.marketplacePublication.findUnique({ where: { id: s.pub.id } });
    expect(pub?.status).toBe("AWARDED");
    const won = await prisma.marketplaceBid.findUnique({ where: { id: s.winningBidId } });
    expect(won?.status).toBe("WON");
  });

  it("does not award when 'Egyik sem' wins, and unfreezes the publication", async () => {
    const s = await scaffoldAwardVote(["0.5000", "0.5000"]);
    await castBallot(s.vote.id, s.noneOption.id, s.units[0].id, "0.5000");
    await castBallot(s.vote.id, s.noneOption.id, s.units[1].id, "0.5000");

    const res = await resolveAwardVote(s.vote.id, s.user.id);
    expect(res).toEqual({ awarded: false, reason: "NONE" });
    expect(dispatchMock).not.toHaveBeenCalled();

    const pub = await prisma.marketplacePublication.findUnique({ where: { id: s.pub.id } });
    expect(pub?.status).toBe("OPEN");
  });

  it("does not award when participation is below quorum", async () => {
    const s = await scaffoldAwardVote(["0.3000", "0.7000"]);
    // Only the 30% unit votes → below the 50% threshold.
    await castBallot(s.vote.id, s.bidOption.id, s.units[0].id, "0.3000");

    const res = await resolveAwardVote(s.vote.id, s.user.id);
    expect(res).toEqual({ awarded: false, reason: "NO_QUORUM" });

    const pub = await prisma.marketplacePublication.findUnique({ where: { id: s.pub.id } });
    expect(pub?.status).toBe("OPEN");
  });
});
