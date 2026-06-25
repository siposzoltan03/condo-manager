import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { awardBid } from "@/lib/marketplace/bidding";
import {
  makeBuilding,
  makeContractorOrg,
  makeMaintenanceTicket,
  makePublication,
  makeBid,
  makeUser,
} from "../fixtures";

// Note on cross-tenant assertions:
// `awardBid` is the library function called by the award route. It trusts
// its caller (decidedByUserId) — the building-ownership check sits in the
// route, not the library. Cross-tenant isolation for award is covered when
// we characterize the award *route* (separate, future test). The paired-
// tenant fixture pattern still applies to the route layer.

describe("awardBid — state machine", () => {
  it("awards the bid, rejects losers, flips publication + ticket", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });
    const { org: winnerOrg } = await makeContractorOrg();
    const { org: loserA } = await makeContractorOrg();
    const { org: loserB } = await makeContractorOrg();
    const winningBid = await makeBid({
      publicationId: pub.id,
      bidderOrgId: winnerOrg.id,
      amount: 100000,
    });
    const losingBidA = await makeBid({
      publicationId: pub.id,
      bidderOrgId: loserA.id,
      amount: 120000,
    });
    const losingBidB = await makeBid({
      publicationId: pub.id,
      bidderOrgId: loserB.id,
      amount: 95000,
    });
    const decider = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const outcome = await awardBid(winningBid.id, decider.id);

    expect(outcome.publicationId).toBe(pub.id);
    expect(outcome.ticketId).toBe(ticket.id);
    expect(outcome.winningBidId).toBe(winningBid.id);
    expect(outcome.winnerOrgId).toBe(winnerOrg.id);
    expect(outcome.rejectedBidIds.sort()).toEqual(
      [losingBidA.id, losingBidB.id].sort(),
    );

    const after = await prisma.marketplaceBid.findUnique({
      where: { id: winningBid.id },
    });
    expect(after!.status).toBe("WON");
    expect(after!.decidedById).toBe(decider.id);
    expect(after!.decidedAt).not.toBeNull();

    const losers = await prisma.marketplaceBid.findMany({
      where: { id: { in: [losingBidA.id, losingBidB.id] } },
    });
    for (const l of losers) {
      expect(l.status).toBe("REJECTED");
      expect(l.decidedById).toBe(decider.id);
      expect(l.decidedAt).not.toBeNull();
      expect(l.decisionReason).toBe("Másik ajánlat lett kiválasztva");
    }

    const afterPub = await prisma.marketplacePublication.findUnique({
      where: { id: pub.id },
    });
    expect(afterPub!.status).toBe("AWARDED");
    expect(afterPub!.awardedBidId).toBe(winningBid.id);
    expect(afterPub!.awardedAt).not.toBeNull();

    const afterTicket = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(afterTicket!.awardedContractorId).toBe(winnerOrg.id);
  });

  it("succeeds with a single bid and empty rejectedBidIds", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });
    const { org } = await makeContractorOrg();
    const bid = await makeBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
    });
    const decider = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const outcome = await awardBid(bid.id, decider.id);

    expect(outcome.winningBidId).toBe(bid.id);
    expect(outcome.rejectedBidIds).toEqual([]);

    const afterPub = await prisma.marketplacePublication.findUnique({
      where: { id: pub.id },
    });
    expect(afterPub!.status).toBe("AWARDED");
  });

  it("is idempotent on an already-awarded publication", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });
    const { org } = await makeContractorOrg();
    const bid = await makeBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
    });
    const decider = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const first = await awardBid(bid.id, decider.id);
    const firstAwardedAt = (
      await prisma.marketplacePublication.findUnique({ where: { id: pub.id } })
    )!.awardedAt;

    // Re-call should return an outcome pointing at the same winner, and
    // should NOT mutate state further (awardedAt unchanged, rejectedBidIds
    // empty since no new losers were rejected).
    const second = await awardBid(bid.id, decider.id);
    expect(second.publicationId).toBe(first.publicationId);
    expect(second.winningBidId).toBe(first.winningBidId);
    expect(second.winnerOrgId).toBe(first.winnerOrgId);
    expect(second.rejectedBidIds).toEqual([]);

    const afterPub = await prisma.marketplacePublication.findUnique({
      where: { id: pub.id },
    });
    expect(afterPub!.awardedAt?.toISOString()).toBe(firstAwardedAt?.toISOString());
  });

  it("throws when awarding a bid that is not SUBMITTED", async () => {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });
    const { org } = await makeContractorOrg();
    const bid = await makeBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      status: "REJECTED",
    });
    const decider = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    await expect(awardBid(bid.id, decider.id)).rejects.toThrow(
      /bid is not submitted/i,
    );

    // No side-effects: publication still OPEN.
    const afterPub = await prisma.marketplacePublication.findUnique({
      where: { id: pub.id },
    });
    expect(afterPub!.status).toBe("OPEN");
  });
});
