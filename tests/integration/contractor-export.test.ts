import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeContractorOrg,
  makeContractorUser,
  makeMaintenanceTicket,
  makePublication,
  makeBid,
  makeUser,
} from "../fixtures";

const { requireContractorOwnerMock } = vi.hoisted(() => ({
  requireContractorOwnerMock: vi.fn(),
}));

vi.mock("@/lib/contractor/session", () => ({
  requireContractor: requireContractorOwnerMock,
  requireContractorOwner: requireContractorOwnerMock,
}));

const { GET } = await import("@/app/api/contractor/settings/export/route");

function asContractorOwner(orgId: string) {
  return {
    userId: `u-${orgId}`,
    orgId,
    role: "OWNER",
    orgStatus: "ACTIVE",
    orgPlan: "FREE",
    orgName: "Test Org",
  };
}

beforeEach(() => {
  requireContractorOwnerMock.mockReset();
});

describe("GET /api/contractor/settings/export", () => {
  it("returns the org's full GDPR payload — contractor + marketplace data combined", async () => {
    const { building } = await makeBuilding();
    const { org } = await makeContractorOrg();
    await makeContractorUser({ orgId: org.id });
    await prisma.contractorDocument.create({
      data: {
        orgId: org.id,
        kind: "insurance",
        fileName: "insurance.pdf",
        storageKey: "k-insurance",
      },
    });
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });
    await makeBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 100000,
    });
    // Seed a thread message + rating.
    await prisma.marketplaceMessage.create({
      data: {
        publicationId: pub.id,
        bidderId: org.id,
        senderSide: "CONTRACTOR",
        senderId: "any",
        body: "Test message",
      },
    });
    const rater = await makeUser({ buildingId: building.id });
    await prisma.contractorRating.create({
      data: {
        contractorOrgId: org.id,
        ticketId: ticket.id,
        rating: 5,
        notes: "Excellent",
        raterId: rater.id,
      },
    });

    requireContractorOwnerMock.mockResolvedValue(asContractorOwner(org.id));

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const text = await res.text();
    const payload = JSON.parse(text);
    expect(payload.gdprArticle).toBe("Article 15");
    expect(payload.org.id).toBe(org.id);
    expect(payload.users).toHaveLength(1);
    expect(payload.documents).toHaveLength(1);
    expect(payload.bids).toHaveLength(1);
    expect(payload.bids[0].amount).toBe(100000);
    expect(payload.messages).toHaveLength(1);
    expect(payload.ratings).toHaveLength(1);
  });

  it("includes only the session org's data, not another org's", async () => {
    const { building } = await makeBuilding();
    const { org, otherOrg } = await makeContractorOrg();
    await makeContractorUser({ orgId: org.id, email: "own@test.local" });
    await makeContractorUser({ orgId: otherOrg.id, email: "other@test.local" });
    // Seed bids on both orgs.
    const ticket = await makeMaintenanceTicket({ buildingId: building.id });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
    });
    await makeBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      amount: 50000,
    });
    // otherOrg also has a publication+bid — must NOT leak.
    const otherTicket = await makeMaintenanceTicket({ buildingId: building.id });
    const otherPub = await makePublication({
      ticketId: otherTicket.id,
      buildingId: building.id,
    });
    await makeBid({
      publicationId: otherPub.id,
      bidderOrgId: otherOrg.id,
      amount: 999999,
    });

    requireContractorOwnerMock.mockResolvedValue(asContractorOwner(org.id));

    const res = await GET();
    expect(res.status).toBe(200);
    const payload = JSON.parse(await res.text());
    expect(payload.org.id).toBe(org.id);
    expect(payload.users.map((u: { email: string }) => u.email)).toEqual([
      "own@test.local",
    ]);
    expect(payload.bids).toHaveLength(1);
    expect(payload.bids[0].amount).toBe(50000);
  });
});
