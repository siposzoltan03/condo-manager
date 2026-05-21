import { describe, it, expect, vi } from "vitest";

// communication-dal.ts pulls in @/lib/auth → next-auth → fails under
// vitest's ESM loader (same workaround as tests/integration/invoice-flow.test.ts).
vi.mock("@/lib/auth", () => ({
  requireBuildingContext: vi.fn(),
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  listWonBids,
  getWonBidWithProject,
  findContractorWonBidForPublication,
  getInvoiceForTicketPublication,
} from "@/lib/marketplace";
import { countActiveBuildingMembers } from "@/lib/communication-dal";
import {
  makeBuilding,
  makeContractorOrg,
  makeMaintenanceTicket,
  makePublication,
  makeBid,
  makeUser,
} from "../fixtures";

/**
 * Phase B coverage prerequisite (refactor plan §3): each RSC query that
 * gets moved into a DAL function gets a smoke test asserting the shape
 * the page consumes. Not exhaustive characterization — these tests just
 * catch silent shape regressions during the page-side migration.
 */

async function seedWonProject(opts: { ticketStatus?: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" } = {}) {
  const { building, otherBuilding } = await makeBuilding();
  const boardUser = await makeUser({
    buildingId: building.id,
    role: "BOARD_MEMBER",
  });
  const ticket = await makeMaintenanceTicket({
    buildingId: building.id,
    status: opts.ticketStatus ?? "ASSIGNED",
  });
  const pub = await makePublication({
    ticketId: ticket.id,
    buildingId: building.id,
    publishedById: boardUser.id,
    status: "AWARDED",
  });
  const { org, otherOrg } = await makeContractorOrg();
  const bid = await makeBid({
    publicationId: pub.id,
    bidderOrgId: org.id,
    status: "WON",
  });
  await prisma.marketplaceBid.update({
    where: { id: bid.id },
    data: { decidedAt: new Date(), decidedById: boardUser.id },
  });
  await prisma.marketplacePublication.update({
    where: { id: pub.id },
    data: { awardedBidId: bid.id, awardedAt: new Date() },
  });
  return { building, otherBuilding, ticket, pub, org, otherOrg, bid };
}

describe("listWonBids — contractor projects RSC", () => {
  it("returns won bids for this org with the page's expected shape", async () => {
    const { bid, pub, org } = await seedWonProject();

    const rows = await listWonBids(org.id);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toBe(bid.id);
    expect(row.publication.id).toBe(pub.id);
    expect(row.publication.scrubbedTitle).toBeTruthy();
    expect(row.publication.ticket?.status).toBe("ASSIGNED");
  });

  it("excludes won bids from other contractor orgs (tenant isolation)", async () => {
    const { otherOrg } = await seedWonProject();
    const rows = await listWonBids(otherOrg.id);
    expect(rows).toHaveLength(0);
  });
});

describe("getWonBidWithProject — contractor project detail RSC", () => {
  it("returns the bid + invoice + publication + ticket for the owning org", async () => {
    const { bid, org } = await seedWonProject({ ticketStatus: "COMPLETED" });
    await prisma.marketplaceInvoice.create({
      data: {
        bidId: bid.id,
        invoiceNumber: "INV-1",
        grossAmount: 100000,
        issuedAt: new Date("2026-05-01"),
        dueAt: new Date("2026-05-15"),
        status: "PENDING",
      },
    });

    const out = await getWonBidWithProject(bid.id, org.id);
    expect(out).not.toBeNull();
    expect(out!.id).toBe(bid.id);
    expect(out!.invoice?.invoiceNumber).toBe("INV-1");
    expect(out!.publication.ticket?.status).toBe("COMPLETED");
    expect(out!.publication.ticket?.building.city).toBeTruthy();
  });

  it("returns null for a different contractor org (tenant isolation)", async () => {
    const { bid, otherOrg } = await seedWonProject();
    const out = await getWonBidWithProject(bid.id, otherOrg.id);
    expect(out).toBeNull();
  });
});

describe("findContractorWonBidForPublication — listing-page redirect shortcut", () => {
  it("returns the bid id for the contractor that won this publication", async () => {
    const { pub, bid, org, otherOrg } = await seedWonProject();
    const own = await findContractorWonBidForPublication(pub.id, org.id);
    expect(own?.id).toBe(bid.id);

    const otherView = await findContractorWonBidForPublication(
      pub.id,
      otherOrg.id,
    );
    expect(otherView).toBeNull();
  });
});

describe("getInvoiceForTicketPublication — board ticket-detail RSC", () => {
  it("returns the invoice attached to the WON bid for a publication", async () => {
    const { pub, bid } = await seedWonProject({ ticketStatus: "COMPLETED" });
    await prisma.marketplaceInvoice.create({
      data: {
        bidId: bid.id,
        invoiceNumber: "INV-RSC-1",
        grossAmount: 200000,
        issuedAt: new Date("2026-05-01"),
        dueAt: new Date("2026-05-15"),
        status: "PENDING",
      },
    });

    const inv = await getInvoiceForTicketPublication(pub.id);
    expect(inv).not.toBeNull();
    expect(inv!.invoiceNumber).toBe("INV-RSC-1");
    expect(inv!.bid.bidder.name).toBeTruthy();
  });

  it("returns null when no invoice has been submitted yet", async () => {
    const { pub } = await seedWonProject({ ticketStatus: "COMPLETED" });
    const inv = await getInvoiceForTicketPublication(pub.id);
    expect(inv).toBeNull();
  });
});

describe("countActiveBuildingMembers — communication RSC", () => {
  it("counts only active members in the requested building", async () => {
    const { building, otherBuilding } = await makeBuilding();

    const a = await makeUser({ buildingId: building.id });
    const b = await makeUser({ buildingId: building.id });
    const inactive = await makeUser({ buildingId: building.id });
    await prisma.userBuilding.updateMany({
      where: { userId: inactive.id, buildingId: building.id },
      data: { isActive: false },
    });
    // One member in the OTHER building — must not leak into the count.
    await makeUser({ buildingId: otherBuilding.id });

    const n = await countActiveBuildingMembers(building.id);
    expect(n).toBe(2);
    void a;
    void b;

    // Cross-tenant assertion: counting from the other building only
    // sees that building's lone active member.
    const other = await countActiveBuildingMembers(otherBuilding.id);
    expect(other).toBe(1);
  });
});
