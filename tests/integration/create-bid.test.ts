import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrUpdateBid } from "@/lib/marketplace/bidding";
import {
  makeBuilding,
  makeContractorOrg,
  makeMaintenanceTicket,
  makePublication,
} from "../fixtures";

async function publicationAndOrg(opts: {
  pubSpecialties?: string[];
  orgSpecialties?: string[];
  orgStatus?: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
} = {}) {
  const { building } = await makeBuilding();
  const ticket = await makeMaintenanceTicket({ buildingId: building.id });
  const pub = await makePublication({
    ticketId: ticket.id,
    buildingId: building.id,
    specialties: opts.pubSpecialties,
  });
  const { org } = await makeContractorOrg({
    status: opts.orgStatus,
    specialties: opts.orgSpecialties,
  });
  return { pub, org };
}

describe("createOrUpdateBid", () => {
  it("creates a SUBMITTED bid on the happy path", async () => {
    const { pub, org } = await publicationAndOrg();

    const result = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 100000,
      etaDays: 7,
      notes: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toBe(false);

    const bid = await prisma.marketplaceBid.findUnique({
      where: { id: result.bidId },
    });
    expect(bid!.status).toBe("SUBMITTED");
    expect(bid!.bidderId).toBe(org.id);
    expect(bid!.publicationId).toBe(pub.id);
    expect(bid!.amount.toString()).toBe("100000");
    expect(bid!.etaDays).toBe(7);
  });

  it("updates an existing SUBMITTED bid instead of creating a new one", async () => {
    const { pub, org } = await publicationAndOrg();

    const first = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 100000,
      etaDays: 7,
      notes: "initial",
    });
    expect(first.ok && !first.updated).toBe(true);

    const second = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 90000,
      etaDays: 5,
      notes: "revised",
    });
    expect(second.ok).toBe(true);
    if (!second.ok || !first.ok) return;
    expect(second.bidId).toBe(first.bidId);
    expect(second.updated).toBe(true);

    const all = await prisma.marketplaceBid.findMany({
      where: { publicationId: pub.id, bidderId: org.id },
    });
    expect(all).toHaveLength(1);
    expect(all[0].amount.toString()).toBe("90000");
    expect(all[0].etaDays).toBe(5);
    expect(all[0].notes).toBe("revised");
  });

  it("rejects with QUOTA_EXCEEDED when a FREE org already has 3 bids in 7 days", async () => {
    const { org } = await makeContractorOrg(); // FREE plan by schema default
    // Seed 3 prior bids (different publications) in the last 7 days.
    for (let i = 0; i < 3; i++) {
      const { pub: priorPub } = await publicationAndOrg({});
      await prisma.marketplaceBid.create({
        data: {
          publicationId: priorPub.id,
          bidderId: org.id,
          amount: 50000 + i * 1000,
          etaDays: 7,
          status: "SUBMITTED",
        },
      });
    }
    // Now try a 4th on a fresh publication.
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });

    const result = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 75000,
      etaDays: 7,
      notes: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("QUOTA_EXCEEDED");

    const noNewBid = await prisma.marketplaceBid.findFirst({
      where: { publicationId: pub.id, bidderId: org.id },
    });
    expect(noNewBid).toBeNull();
  });

  it("rejects with SPECIALTY_MISMATCH when publication and org share no specialty", async () => {
    const { pub, org } = await publicationAndOrg({
      pubSpecialties: ["electrical"],
      orgSpecialties: ["plumbing"],
    });

    const result = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 100000,
      etaDays: 7,
      notes: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("SPECIALTY_MISMATCH");
  });

  it("rejects with ORG_NOT_ACTIVE when the contractor org is PENDING_VERIFICATION", async () => {
    const { pub, org } = await publicationAndOrg({
      orgStatus: "PENDING_VERIFICATION",
    });

    const result = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 100000,
      etaDays: 7,
      notes: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ORG_NOT_ACTIVE");
  });

  it("rejects INVALID_AMOUNT for non-positive amounts and INVALID_ETA for out-of-range etaDays", async () => {
    const { pub, org } = await publicationAndOrg();

    const badAmount = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 0,
      etaDays: 7,
      notes: null,
    });
    expect(badAmount.ok).toBe(false);
    if (!badAmount.ok) expect(badAmount.reason).toBe("INVALID_AMOUNT");

    const badEta = await createOrUpdateBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 100000,
      etaDays: 0,
      notes: null,
    });
    expect(badEta.ok).toBe(false);
    if (!badEta.ok) expect(badEta.reason).toBe("INVALID_ETA");

    const noBids = await prisma.marketplaceBid.count({
      where: { publicationId: pub.id, bidderId: org.id },
    });
    expect(noBids).toBe(0);
  });
});
