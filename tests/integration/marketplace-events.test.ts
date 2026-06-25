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

// Stub the queue — notify() writes the Notification row inline but
// enqueues a delivery job. We assert the row, not the job.
vi.mock("@/lib/queue", () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) },
  scheduledQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

const events = await import("@/lib/marketplace");

/**
 * Phase E strict coverage prerequisite: every event helper that this
 * phase introduces gets an explicit assertion that the side effect
 * (AuditLog row, Notification row, or both) actually fires. Catches
 * the "silent drop" risk the plan calls out.
 */

async function seedAwardedScenario() {
  const { building } = await makeBuilding();
  const boardUser = await makeUser({
    buildingId: building.id,
    role: "BOARD_MEMBER",
  });
  const ticket = await makeMaintenanceTicket({
    buildingId: building.id,
    status: "ASSIGNED",
  });
  const pub = await makePublication({
    ticketId: ticket.id,
    buildingId: building.id,
    publishedById: boardUser.id,
    scrubbedTitle: "Plumbing fix",
  });
  const { org } = await makeContractorOrg();
  const owner = await makeContractorUser({ orgId: org.id });
  const bid = await makeBid({
    publicationId: pub.id,
    bidderOrgId: org.id,
    status: "SUBMITTED",
  });
  return { building, boardUser, ticket, pub, org, owner, bid };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("marketplaceEvents.bidWasSubmitted", () => {
  it("creates an AuditLog (CREATE) and notifies the publisher", async () => {
    const { boardUser, pub, bid } = await seedAwardedScenario();

    await events.bidWasSubmitted({
      bidId: bid.id,
      userId: boardUser.id,
      amount: 100000,
      etaDays: 7,
      publicationId: pub.id,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MarketplaceBid", entityId: bid.id, action: "CREATE" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe(boardUser.id);

    const notif = await prisma.notification.findFirst({
      where: { userId: boardUser.id, type: "MARKETPLACE_NEW_BID" },
    });
    expect(notif).not.toBeNull();
    expect(notif!.entityId).toBe(pub.id);
  });
});

describe("marketplaceEvents.bidWasUpdated", () => {
  it("creates an AuditLog (UPDATE) but no Notification", async () => {
    const { boardUser, bid } = await seedAwardedScenario();

    await events.bidWasUpdated({
      bidId: bid.id,
      userId: boardUser.id,
      amount: 90000,
      etaDays: 5,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MarketplaceBid", entityId: bid.id, action: "UPDATE" },
    });
    expect(audit).not.toBeNull();

    const notifs = await prisma.notification.count({
      where: { type: "MARKETPLACE_NEW_BID" },
    });
    expect(notifs).toBe(0);
  });
});

describe("marketplaceEvents.bidWasAwarded", () => {
  it("creates an AuditLog (UPDATE) on the publication and notifies the winner", async () => {
    const { boardUser, pub, org, owner, bid } = await seedAwardedScenario();

    await events.bidWasAwarded({
      publicationId: pub.id,
      winningBidId: bid.id,
      winnerOrgId: org.id,
      awardedByUserId: boardUser.id,
      scrubbedTitle: pub.scrubbedTitle,
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: "MarketplacePublication",
        entityId: pub.id,
        action: "UPDATE",
      },
    });
    expect(audit).not.toBeNull();

    const notif = await prisma.notification.findFirst({
      where: {
        contractorUserId: owner.id,
        type: "MARKETPLACE_BID_WON",
      },
    });
    expect(notif).not.toBeNull();
    expect(notif!.entityId).toBe(pub.id);
  });
});

describe("marketplaceEvents.bidWasRejected", () => {
  it("notifies the loser contractor user", async () => {
    const { pub, owner } = await seedAwardedScenario();

    await events.bidWasRejected({
      publicationId: pub.id,
      contractorUserId: owner.id,
      scrubbedTitle: pub.scrubbedTitle,
      reason: "Másik ajánlat lett kiválasztva",
    });

    const notif = await prisma.notification.findFirst({
      where: {
        contractorUserId: owner.id,
        type: "MARKETPLACE_BID_REJECTED",
      },
    });
    expect(notif).not.toBeNull();
    expect(notif!.body).toBe("Másik ajánlat lett kiválasztva");
  });
});

describe("marketplaceEvents.projectStatusAdvanced", () => {
  it("notifies the publisher", async () => {
    const { boardUser, pub, ticket } = await seedAwardedScenario();

    await events.projectStatusAdvanced({
      ticketId: ticket.id,
      publishedById: boardUser.id,
      scrubbedTitle: pub.scrubbedTitle,
      ticketTrackingNumber: ticket.trackingNumber,
      next: "IN_PROGRESS",
    });

    const notif = await prisma.notification.findFirst({
      where: {
        userId: boardUser.id,
        type: "MARKETPLACE_PROJECT_STATUS",
      },
    });
    expect(notif).not.toBeNull();
  });
});

describe("marketplaceEvents.invoiceWasSubmitted", () => {
  it("notifies the publisher", async () => {
    const { boardUser, pub, ticket } = await seedAwardedScenario();

    await events.invoiceWasSubmitted({
      invoiceId: "inv_test",
      publicationId: pub.id,
      publishedById: boardUser.id,
      scrubbedTitle: pub.scrubbedTitle,
      ticketTrackingNumber: ticket.trackingNumber,
      invoiceNumber: "INV-2026-100",
      grossAmount: 250000,
    });

    const notif = await prisma.notification.findFirst({
      where: { userId: boardUser.id, type: "MARKETPLACE_INVOICE_NEW" },
    });
    expect(notif).not.toBeNull();
  });
});

describe("marketplaceEvents.invoiceWasPaid", () => {
  it("creates an AuditLog and notifies the contractor", async () => {
    const { building, boardUser, pub, owner } = await seedAwardedScenario();

    await events.invoiceWasPaid({
      invoiceId: "inv_paid",
      buildingId: building.id,
      paidByUserId: boardUser.id,
      contractorUserId: owner.id,
      scrubbedTitle: pub.scrubbedTitle,
      invoiceNumber: "INV-2026-200",
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MarketplaceInvoice", entityId: "inv_paid" },
    });
    expect(audit).not.toBeNull();

    const notif = await prisma.notification.findFirst({
      where: {
        contractorUserId: owner.id,
        type: "MARKETPLACE_INVOICE_PAID",
      },
    });
    expect(notif).not.toBeNull();
  });
});

describe("marketplaceEvents.messageFromContractor", () => {
  it("notifies the publisher", async () => {
    const { boardUser, pub } = await seedAwardedScenario();

    await events.messageFromContractor({
      publicationId: pub.id,
      publishedById: boardUser.id,
      scrubbedTitle: pub.scrubbedTitle,
    });

    const notif = await prisma.notification.findFirst({
      where: { userId: boardUser.id, type: "MARKETPLACE_MESSAGE_CONTRACTOR" },
    });
    expect(notif).not.toBeNull();
  });
});

describe("marketplaceEvents.messageFromBoard", () => {
  it("notifies the contractor org's OWNER user", async () => {
    const { pub, org, owner } = await seedAwardedScenario();

    await events.messageFromBoard({
      publicationId: pub.id,
      bidderOrgId: org.id,
      scrubbedTitle: pub.scrubbedTitle,
    });

    const notif = await prisma.notification.findFirst({
      where: {
        contractorUserId: owner.id,
        type: "MARKETPLACE_MESSAGE_BOARD",
      },
    });
    expect(notif).not.toBeNull();
  });
});
