import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";
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
 * The votes-close cron closes every OPEN vote past its deadline and, for
 * contractor-award votes, runs resolveAwardVote — so a winning bid is awarded
 * even when no board member manually closes the vote. Email dispatch is mocked
 * to assert the close + award state machine in isolation.
 */

const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }));
vi.mock("@/lib/marketplace/award-notify", () => ({
  dispatchAwardOutcome: dispatchMock,
}));

const { createAwardVote } = await import("@/lib/marketplace/award-vote");
const { GET } = await import("@/app/api/cron/votes-close/route");

const SECRET = "test-cron-secret";
beforeAll(() => {
  process.env.CRON_SECRET = SECRET;
});
beforeEach(() => dispatchMock.mockReset());

function req(withAuth = true) {
  return new NextRequest("http://test/api/cron/votes-close", {
    headers: withAuth ? { authorization: `Bearer ${SECRET}` } : {},
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

describe("votes-close cron", () => {
  it("rejects a request without the CRON_SECRET", async () => {
    expect((await GET(req(false))).status).toBe(401);
  });

  it("closes an expired plain vote", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const vote = await prisma.vote.create({
      data: {
        title: "Régi szavazás",
        voteType: "YES_NO",
        status: "OPEN",
        majorityType: "SIMPLE_MAJORITY",
        quorumRequired: "0.5",
        deadline: new Date(Date.now() - 86_400_000), // yesterday
        buildingId: building.id,
        createdById: user.id,
        options: { create: [{ label: "Igen", sortOrder: 0 }, { label: "Nem", sortOrder: 1 }] },
      },
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const after = await prisma.vote.findUnique({ where: { id: vote.id } });
    expect(after?.status).toBe("CLOSED");
  });

  it("auto-awards an expired, quorate award vote", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({ ticketId: ticket.id, buildingId: building.id });
    const { org: a } = await makeContractorOrg({ name: "A Kft." });
    const { org: b } = await makeContractorOrg({ name: "B Kft." });
    const bidA = await makeBid({ publicationId: pub.id, bidderOrgId: a.id, amount: 1_000_000 });
    await makeBid({ publicationId: pub.id, bidderOrgId: b.id, amount: 2_000_000 });
    const user = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const meeting = await prisma.meeting.create({
      data: { title: "KGY", date: new Date(), time: "18:00", buildingId: building.id, createdById: user.id, agenda: [] },
    });
    const u1 = await makeUnit(building.id, "0.5000");
    const u2 = await makeUnit(building.id, "0.5000");

    await createAwardVote({
      publicationId: pub.id,
      meetingId: meeting.id,
      buildingId: building.id,
      createdByUserId: user.id,
    });
    const vote = await prisma.vote.findFirstOrThrow({
      where: { linkedPublicationId: pub.id },
      include: { options: true },
    });
    const bidOption = vote.options.find((o) => o.bidId === bidA.id)!;
    // Push the deadline into the past + cast a quorate set of ballots for bid A.
    await prisma.vote.update({ where: { id: vote.id }, data: { deadline: new Date(Date.now() - 3600_000) } });
    await prisma.ballot.create({ data: { voteId: vote.id, optionId: bidOption.id, unitId: u1.id, weight: "0.5000" } });
    await prisma.ballot.create({ data: { voteId: vote.id, optionId: bidOption.id, unitId: u2.id, weight: "0.5000" } });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.closedCount).toBeGreaterThanOrEqual(1);

    const closed = await prisma.vote.findUnique({ where: { id: vote.id } });
    expect(closed?.status).toBe("CLOSED");
    const wonPub = await prisma.marketplacePublication.findUnique({ where: { id: pub.id } });
    expect(wonPub?.status).toBe("AWARDED");
    const wonBid = await prisma.marketplaceBid.findUnique({ where: { id: bidA.id } });
    expect(wonBid?.status).toBe("WON");
    expect(dispatchMock).toHaveBeenCalled();
  });
});
