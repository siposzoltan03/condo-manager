import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Marketplace Data Access Layer.
 *
 * Owns every prisma call needed by `lib/marketplace/*` services and the
 * marketplace-facing API routes. Service files (`bidding.ts`,
 * `publishing.ts`, ...) must not import prisma directly — they call into
 * this file. Routes import from `@/lib/marketplace` (the index barrel),
 * not from `./dal` directly. The ESLint rule in §4 #2 enforces both
 * boundaries.
 *
 * Conventions:
 *   - Each function uses Prisma `select` (never bare findUnique on a
 *     model) so the inferred return type is a narrow DTO and internal
 *     columns can't accidentally leak. See §4 #5.
 *   - Transactional helpers accept an optional `tx` parameter — the
 *     service orchestrates `prisma.$transaction` and threads the tx
 *     client through.
 *   - Cross-domain reads (contractor / maintenance tables) live in this
 *     file for now, grouped at the bottom. They will move when those
 *     domains get their own DALs in Phase C and Phase F.
 */

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Run a callback inside a transaction. Services orchestrate
 * multi-statement workflows by passing the returned `tx` to DAL
 * helpers — services do not need to import prisma themselves.
 */
export async function runTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}

// ────────────────────────────────────────────────────────────────────────
// MarketplaceBid
// ────────────────────────────────────────────────────────────────────────

export async function findBidForAward(db: Db, bidId: string) {
  return db.marketplaceBid.findUnique({
    where: { id: bidId },
    include: {
      publication: { select: { id: true, ticketId: true, status: true } },
    },
  });
}

export async function findExistingAwardedBidId(db: Db, publicationId: string) {
  return db.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: { awardedBidId: true },
  });
}

export async function markBidWon(
  db: Db,
  bidId: string,
  decidedAt: Date,
  decidedById: string,
) {
  return db.marketplaceBid.update({
    where: { id: bidId },
    data: { status: "WON", decidedAt, decidedById },
  });
}

export async function findLosingBidIds(
  db: Db,
  publicationId: string,
  winningBidId: string,
) {
  return db.marketplaceBid.findMany({
    where: {
      publicationId,
      status: "SUBMITTED",
      NOT: { id: winningBidId },
    },
    select: { id: true, bidderId: true },
  });
}

export async function rejectLosingBids(
  db: Db,
  publicationId: string,
  winningBidId: string,
  reason: string,
  decidedAt: Date,
  decidedById: string,
) {
  return db.marketplaceBid.updateMany({
    where: {
      publicationId,
      status: "SUBMITTED",
      NOT: { id: winningBidId },
    },
    data: {
      status: "REJECTED",
      decidedAt,
      decidedById,
      decisionReason: reason,
    },
  });
}

export async function findBidByPubAndOrg(
  publicationId: string,
  bidderId: string,
) {
  return prisma.marketplaceBid.findUnique({
    where: { publicationId_bidderId: { publicationId, bidderId } },
    select: { id: true, status: true },
  });
}

export async function createBid(data: {
  publicationId: string;
  bidderId: string;
  amount: number;
  etaDays: number;
  notes: string | null;
}) {
  return prisma.marketplaceBid.create({
    data: { ...data, status: "SUBMITTED" },
    select: { id: true },
  });
}

export async function updateBid(
  bidId: string,
  data: { amount: number; etaDays: number; notes: string | null },
) {
  return prisma.marketplaceBid.update({
    where: { id: bidId },
    data,
  });
}

export async function countActiveBidsByOrgSince(orgId: string, since: Date) {
  return prisma.marketplaceBid.count({
    where: {
      bidderId: orgId,
      createdAt: { gte: since },
      status: { in: ["SUBMITTED", "WON"] },
    },
  });
}

export async function getBidByContractor(
  publicationId: string,
  orgId: string,
) {
  return prisma.marketplaceBid.findUnique({
    where: { publicationId_bidderId: { publicationId, bidderId: orgId } },
    select: {
      id: true,
      amount: true,
      etaDays: true,
      notes: true,
      status: true,
      decisionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getBidsForPublication(publicationId: string) {
  return prisma.marketplaceBid.findMany({
    where: { publicationId, status: { in: ["SUBMITTED", "WON"] } },
    include: {
      bidder: {
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
          navConfirmedAt: true,
          _count: { select: { awardedTickets: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findBidForStatusUpdate(bidId: string) {
  return prisma.marketplaceBid.findUnique({
    where: { id: bidId },
    select: {
      bidderId: true,
      status: true,
      publication: {
        select: {
          publishedById: true,
          scrubbedTitle: true,
          ticket: { select: { id: true, status: true, trackingNumber: true } },
        },
      },
    },
  });
}

export async function findBidForInvoiceUpload(bidId: string) {
  return prisma.marketplaceBid.findUnique({
    where: { id: bidId },
    select: {
      bidderId: true,
      status: true,
      publication: {
        select: {
          publishedById: true,
          scrubbedTitle: true,
          ticket: { select: { id: true, status: true, trackingNumber: true } },
        },
      },
      invoice: { select: { id: true, status: true, storageKey: true } },
    },
  });
}

/**
 * RSC: list of ALL bids for a contractor's "Leads" page (any status).
 * Includes a thin publication snapshot for the row UI.
 */
export async function listAllBidsByOrg(orgId: string) {
  return prisma.marketplaceBid.findMany({
    where: { bidderId: orgId },
    select: {
      id: true,
      amount: true,
      etaDays: true,
      status: true,
      createdAt: true,
      publication: {
        select: {
          id: true,
          scrubbedTitle: true,
          city: true,
          zip: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * RSC: list of won bids for a contractor org's "Projects" page. Includes
 * the publication + ticket-status snapshot so the page can bucket
 * active vs closed without a second query.
 */
export async function listWonBids(orgId: string) {
  return prisma.marketplaceBid.findMany({
    where: { bidderId: orgId, status: "WON" },
    select: {
      id: true,
      amount: true,
      etaDays: true,
      decidedAt: true,
      publication: {
        select: {
          id: true,
          scrubbedTitle: true,
          category: true,
          city: true,
          zip: true,
          publisherDisplayName: true,
          awardedAt: true,
          ticket: { select: { status: true } },
        },
      },
    },
    orderBy: { decidedAt: "desc" },
  });
}

/**
 * RSC: single won project detail for the `/contractor/projects/[bidId]`
 * page. Org-scoped at the DB layer: returns null if the bid is not WON
 * by `orgId`, so callers don't need a defensive ownership check.
 */
export async function getWonBidWithProject(bidId: string, orgId: string) {
  return prisma.marketplaceBid.findFirst({
    where: { id: bidId, bidderId: orgId, status: "WON" },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          grossAmount: true,
          issuedAt: true,
          dueAt: true,
          status: true,
          paidAt: true,
          storageKey: true,
          fileName: true,
        },
      },
      publication: {
        include: {
          ticket: {
            select: {
              id: true,
              status: true,
              location: true,
              building: {
                select: { address: true, city: true, zipCode: true },
              },
              ratings: {
                where: { contractorOrgId: orgId },
                select: { rating: true, notes: true, createdAt: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
}

/**
 * RSC: redirect-shortcut on the contractor-side publication detail page.
 * If this contractor has already won this publication, the page sends
 * them straight to the project view.
 */
export async function findContractorWonBidForPublication(
  publicationId: string,
  orgId: string,
) {
  return prisma.marketplaceBid.findFirst({
    where: { publicationId, bidderId: orgId, status: "WON" },
    select: { id: true },
  });
}

/**
 * RSC: invoice attached to the WON bid for a given publication, used by
 * the board's ticket-detail page to surface the invoice card.
 */
export async function getInvoiceForTicketPublication(publicationId: string) {
  return prisma.marketplaceInvoice.findFirst({
    where: { bid: { publicationId, status: "WON" } },
    select: {
      id: true,
      invoiceNumber: true,
      grossAmount: true,
      issuedAt: true,
      dueAt: true,
      status: true,
      paidAt: true,
      storageKey: true,
      fileName: true,
      bid: {
        select: {
          bidder: { select: { name: true } },
        },
      },
    },
  });
}

export async function findLoserBidsForEmail(bidIds: string[]) {
  return prisma.marketplaceBid.findMany({
    where: { id: { in: bidIds } },
    select: {
      decisionReason: true,
      bidder: {
        select: {
          users: {
            where: { role: "OWNER" },
            select: { id: true, email: true, name: true },
            take: 1,
          },
        },
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// MarketplacePublication
// ────────────────────────────────────────────────────────────────────────

export async function findPublicationForBidding(publicationId: string) {
  return prisma.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: { id: true, status: true, specialties: true },
  });
}

export async function findPublicationByTicketId(ticketId: string) {
  return prisma.marketplacePublication.findUnique({
    where: { ticketId },
    select: {
      id: true,
      status: true,
      scrubbedTitle: true,
      scrubbedDescription: true,
      category: true,
      urgency: true,
      city: true,
      zip: true,
      budgetBand: true,
      deadlineAt: true,
      specialties: true,
      publishedAt: true,
      closedAt: true,
      closeReason: true,
      awardedAt: true,
      revealAddressOnAward: true,
      revealUnitOnAward: true,
      revealOwnerPhoneOnAward: true,
      publisherDisplayName: true,
      boardContactEmail: true,
      boardContactPhone: true,
      _count: { select: { bids: true } },
    },
  });
}

export async function findPublicationForBoardAccess(
  publicationId: string,
  bidderId: string,
) {
  return prisma.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: {
      id: true,
      status: true,
      awardedBidId: true,
      ticket: { select: { buildingId: true } },
      bids: {
        where: { bidderId },
        select: { id: true, status: true },
      },
    },
  });
}

export async function findPublicationForContractorAccess(
  publicationId: string,
  bidderOrgId: string,
) {
  return prisma.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: {
      id: true,
      status: true,
      awardedBidId: true,
      bids: {
        where: { bidderId: bidderOrgId },
        select: { id: true },
      },
    },
  });
}

export async function findPublicationForContractorDetail(
  publicationId: string,
) {
  return prisma.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: {
      id: true,
      status: true,
      scrubbedTitle: true,
      scrubbedDescription: true,
      category: true,
      urgency: true,
      city: true,
      zip: true,
      budgetBand: true,
      deadlineAt: true,
      specialties: true,
      publishedAt: true,
      publisherDisplayName: true,
      _count: { select: { bids: true } },
    },
  });
}

export interface OpenPublicationsFilterDb {
  city?: string;
  postedWithinDays?: number;
  excludeBidByOrgId?: string;
  take?: number;
}

export async function findOpenPublications(filter: OpenPublicationsFilterDb) {
  return prisma.marketplacePublication.findMany({
    where: {
      status: "OPEN",
      ...(filter.city ? { city: filter.city } : {}),
      ...(filter.postedWithinDays
        ? {
            publishedAt: {
              gte: new Date(
                Date.now() - filter.postedWithinDays * 24 * 60 * 60 * 1000,
              ),
            },
          }
        : {}),
      ...(filter.excludeBidByOrgId
        ? {
            bids: { none: { bidderId: filter.excludeBidByOrgId } },
          }
        : {}),
    },
    select: {
      id: true,
      scrubbedTitle: true,
      scrubbedDescription: true,
      category: true,
      urgency: true,
      city: true,
      zip: true,
      budgetBand: true,
      deadlineAt: true,
      specialties: true,
      publishedAt: true,
      publisherDisplayName: true,
      _count: { select: { bids: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: filter.take ?? 50,
  });
}

export async function findPublicationPublisher(publicationId: string) {
  return prisma.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: {
      publishedById: true,
      scrubbedTitle: true,
      _count: { select: { bids: true } },
    },
  });
}

export async function findPublicationTitle(publicationId: string) {
  return prisma.marketplacePublication.findUnique({
    where: { id: publicationId },
    select: { scrubbedTitle: true },
  });
}

export async function createPublication(data: {
  ticketId: string;
  scrubbedTitle: string;
  scrubbedDescription: string;
  category: string;
  urgency: string;
  city: string;
  zip: string;
  budgetBand: string | null;
  deadlineAt: Date;
  specialties: string[];
  revealAddressOnAward: boolean;
  revealUnitOnAward: boolean;
  revealOwnerPhoneOnAward: boolean;
  boardContactEmail: string;
  boardContactPhone: string | null;
  publishedById: string;
  publisherDisplayName: string;
}) {
  return prisma.marketplacePublication.create({
    data: { ...data, status: "OPEN" },
    select: { id: true, ticketId: true },
  });
}

export async function setPublicationAwarded(
  db: Db,
  publicationId: string,
  awardedBidId: string,
  awardedAt: Date,
) {
  return db.marketplacePublication.update({
    where: { id: publicationId },
    data: { status: "AWARDED", awardedAt, awardedBidId },
  });
}

export async function setPublicationClosed(
  publicationId: string,
  closeReason: string | null,
) {
  return prisma.marketplacePublication.update({
    where: { id: publicationId },
    data: { status: "CLOSED", closedAt: new Date(), closeReason },
  });
}

export async function findAwardedPublicationsForMedian(city: string) {
  return prisma.marketplacePublication.findMany({
    where: { city, status: { in: ["AWARDED", "CLOSED"] } },
    select: {
      specialties: true,
      awardedBid: { select: { amount: true } },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// MarketplaceMessage
// ────────────────────────────────────────────────────────────────────────

export async function findThreadMessages(
  publicationId: string,
  bidderId: string,
) {
  return prisma.marketplaceMessage.findMany({
    where: { publicationId, bidderId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      senderSide: true,
      senderId: true,
      body: true,
      createdAt: true,
    },
  });
}

export async function createThreadMessage(data: {
  publicationId: string;
  bidderId: string;
  senderSide: "BOARD" | "CONTRACTOR";
  senderId: string;
  body: string;
}) {
  return prisma.marketplaceMessage.create({
    data,
    select: { id: true, createdAt: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// MarketplaceInvoice
// ────────────────────────────────────────────────────────────────────────

export async function upsertInvoice(
  bidId: string,
  data: {
    invoiceNumber: string;
    grossAmount: number;
    issuedAt: Date;
    dueAt: Date;
    storageKey: string | null;
    fileName: string | null;
  },
) {
  return prisma.marketplaceInvoice.upsert({
    where: { bidId },
    update: {
      invoiceNumber: data.invoiceNumber,
      grossAmount: data.grossAmount,
      issuedAt: data.issuedAt,
      dueAt: data.dueAt,
      ...(data.storageKey
        ? { storageKey: data.storageKey, fileName: data.fileName }
        : {}),
    },
    create: { bidId, ...data },
    select: {
      id: true,
      invoiceNumber: true,
      grossAmount: true,
      issuedAt: true,
      dueAt: true,
      storageKey: true,
      fileName: true,
      status: true,
      paidAt: true,
    },
  });
}

export async function findInvoiceFileById(invoiceId: string) {
  return prisma.marketplaceInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      storageKey: true,
      fileName: true,
      bid: {
        select: {
          bidderId: true,
          publication: {
            select: { ticket: { select: { buildingId: true } } },
          },
        },
      },
    },
  });
}

export async function setInvoicePaid(
  invoiceId: string,
  paidAt: Date,
  paidById: string,
  db: Db = prisma,
) {
  return db.marketplaceInvoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt, paidById },
  });
}

// ────────────────────────────────────────────────────────────────────────
// MarketplaceFitScore
// ────────────────────────────────────────────────────────────────────────

export async function upsertFitScore(data: {
  bidId: string;
  publicationId: string;
  score: number;
  rationale: string;
  weightsVersion: string;
  factorsJson: Prisma.InputJsonValue;
}) {
  return prisma.marketplaceFitScore.upsert({
    where: { bidId: data.bidId },
    create: data,
    update: {
      score: data.score,
      rationale: data.rationale,
      weightsVersion: data.weightsVersion,
      factorsJson: data.factorsJson,
      computedAt: new Date(),
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// MaintenanceTicket — used by award-flow + publishing + mark-paid
// ────────────────────────────────────────────────────────────────────────
// These cross-domain reads stay in marketplace DAL until Phase F creates
// `lib/maintenance/dal.ts`. At that point each function below either
// moves to that DAL (callers update) or is removed in favour of a
// maintenance-DAL equivalent.

export async function stampTicketAwardedContractor(
  db: Db,
  ticketId: string,
  awardedContractorId: string,
) {
  return db.maintenanceTicket.update({
    where: { id: ticketId },
    data: { awardedContractorId },
  });
}

export async function setTicketStatus(
  ticketId: string,
  status: "IN_PROGRESS" | "COMPLETED" | "VERIFIED",
  db: Db = prisma,
) {
  return db.maintenanceTicket.update({
    where: { id: ticketId },
    data: { status },
  });
}

export async function findTicketForPublishingSnapshot(ticketId: string) {
  return prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      status: true,
      category: true,
      building: { select: { city: true, zipCode: true } },
      publication: { select: { id: true } },
    },
  });
}

export async function findTicketForAwardRoute(ticketId: string) {
  return prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: {
      buildingId: true,
      title: true,
      description: true,
      location: true,
      building: { select: { address: true, city: true, zipCode: true } },
      publication: {
        select: {
          id: true,
          status: true,
          scrubbedTitle: true,
          revealAddressOnAward: true,
          revealUnitOnAward: true,
          revealOwnerPhoneOnAward: true,
          boardContactEmail: true,
          boardContactPhone: true,
        },
      },
    },
  });
}

export async function findTicketForMarkPaidRoute(ticketId: string) {
  return prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      buildingId: true,
      status: true,
      trackingNumber: true,
      publication: {
        select: {
          id: true,
          scrubbedTitle: true,
          awardedBid: {
            select: {
              id: true,
              bidder: {
                select: {
                  users: {
                    where: { role: "OWNER" },
                    select: { id: true, email: true, name: true },
                    take: 1,
                  },
                },
              },
              invoice: {
                select: { id: true, status: true, invoiceNumber: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function findCompletedTicketsForOrgs(orgIds: string[]) {
  return prisma.maintenanceTicket.findMany({
    where: {
      awardedContractorId: { in: orgIds },
      status: { in: ["COMPLETED", "VERIFIED"] },
    },
    select: {
      awardedContractorId: true,
      building: { select: { city: true } },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Contractor cross-domain reads — these move out when Phase C creates
// `lib/contractor/dal.ts`.
// ────────────────────────────────────────────────────────────────────────

export async function findOrgForBiddingPolicy(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: { id: true, status: true, specialties: true },
  });
}

export async function findOrgPlanState(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: { plan: true, planStatus: true, trialEndsAt: true },
  });
}

export async function findOrgsNavStatus(orgIds: string[]) {
  return prisma.contractorOrg.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, navConfirmedAt: true },
  });
}

export async function findRatingsForOrgs(orgIds: string[]) {
  return prisma.contractorRating.findMany({
    where: { contractorOrgId: { in: orgIds } },
    select: { contractorOrgId: true, rating: true },
  });
}

export async function findInsuranceDocsForOrgs(orgIds: string[]) {
  return prisma.contractorDocument.findMany({
    where: { orgId: { in: orgIds }, kind: "insurance" },
    select: { orgId: true, validUntil: true },
  });
}

export async function findContractorOrgOwner(orgId: string) {
  return prisma.contractorUser.findFirst({
    where: { orgId, role: "OWNER" },
    select: { id: true, email: true, name: true },
  });
}

export async function findContractorOrgWithOwner(orgId: string) {
  return prisma.contractorOrg.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      users: {
        where: { role: "OWNER" },
        select: { id: true, email: true, name: true },
        take: 1,
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// Misc cross-domain
// ────────────────────────────────────────────────────────────────────────

export async function findUserNameById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
}

// ────────────────────────────────────────────────────────────────────────
// GDPR export — marketplace-side data for a contractor org
// ────────────────────────────────────────────────────────────────────────

export async function listAllBidsByOrgForExport(orgId: string) {
  return prisma.marketplaceBid.findMany({
    where: { bidderId: orgId },
    select: {
      id: true,
      publicationId: true,
      amount: true,
      etaDays: true,
      notes: true,
      status: true,
      decidedAt: true,
      decisionReason: true,
      createdAt: true,
    },
  });
}

export async function listAllMessagesByOrgForExport(orgId: string) {
  return prisma.marketplaceMessage.findMany({
    where: { bidderId: orgId },
    select: {
      id: true,
      publicationId: true,
      senderSide: true,
      body: true,
      createdAt: true,
    },
  });
}
