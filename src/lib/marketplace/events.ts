import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import * as dal from "./dal";

/**
 * Marketplace domain events. Each helper wraps the audit-log + notify
 * side-effects for one logical event in one place. Routes (and future
 * services) call these instead of `createAuditLog` / `notify` directly
 * — the convention from §4 #4 of the refactor plan.
 *
 * These are intentionally THIN: only audit + notify. Email sends,
 * complex DAL queries, and orchestration around the event stay at the
 * caller (until Phase F slims those routes into services).
 *
 * Per the plan's strict coverage prereq, every event below has a
 * "still fires" assertion in `tests/integration/marketplace-events.test.ts`.
 */

export async function bidWasSubmitted(opts: {
  bidId: string;
  userId: string;
  amount: number;
  etaDays: number;
  publicationId: string;
}) {
  await createAuditLog({
    entityType: "MarketplaceBid",
    entityId: opts.bidId,
    action: "CREATE",
    userId: opts.userId,
    newValue: { amount: opts.amount, etaDays: opts.etaDays },
  }).catch(() => undefined);

  const pub = await dal.findPublicationPublisher(opts.publicationId);
  if (!pub) return;
  await notify({
    userIds: [pub.publishedById],
    type: NotificationType.MARKETPLACE_NEW_BID,
    title: `Új ajánlat — ${pub.scrubbedTitle}`,
    body: `Új ajánlat érkezett a hirdetésre. Jelenlegi ajánlatok száma: ${pub._count.bids}.`,
    entityType: "MarketplacePublication",
    entityId: opts.publicationId,
  });
}

export async function bidWasUpdated(opts: {
  bidId: string;
  userId: string;
  amount: number;
  etaDays: number;
}) {
  // Updates are audit-only — no notification (publisher already saw
  // the original bid; treating revisions as new noise is annoying).
  await createAuditLog({
    entityType: "MarketplaceBid",
    entityId: opts.bidId,
    action: "UPDATE",
    userId: opts.userId,
    newValue: { amount: opts.amount, etaDays: opts.etaDays },
  }).catch(() => undefined);
}

export async function bidWasAwarded(opts: {
  publicationId: string;
  winningBidId: string;
  winnerOrgId: string;
  awardedByUserId: string;
  scrubbedTitle: string;
}) {
  await createAuditLog({
    entityType: "MarketplacePublication",
    entityId: opts.publicationId,
    action: "UPDATE",
    userId: opts.awardedByUserId,
    newValue: { status: "AWARDED", winningBidId: opts.winningBidId },
  }).catch(() => undefined);

  const owner = await dal.findContractorOrgOwner(opts.winnerOrgId);
  if (!owner) return;
  await notify({
    contractorUserIds: [owner.id],
    type: NotificationType.MARKETPLACE_BID_WON,
    title: opts.scrubbedTitle,
    body: "Megnyerted a pályázatot. A megrendelő elérhetőségei a Projektjeim oldalon.",
    entityType: "MarketplacePublication",
    entityId: opts.publicationId,
  });
}

/**
 * Per-loser notification. Caller loops over `outcome.rejectedBidIds`
 * and the supporting bidder owner lookups, calling this once per loser.
 */
export async function bidWasRejected(opts: {
  publicationId: string;
  contractorUserId: string;
  scrubbedTitle: string;
  reason: string;
}) {
  await notify({
    contractorUserIds: [opts.contractorUserId],
    type: NotificationType.MARKETPLACE_BID_REJECTED,
    title: opts.scrubbedTitle,
    body: opts.reason,
    entityType: "MarketplacePublication",
    entityId: opts.publicationId,
  });
}

export async function projectStatusAdvanced(opts: {
  ticketId: string;
  publishedById: string;
  scrubbedTitle: string;
  ticketTrackingNumber: string;
  next: "IN_PROGRESS" | "COMPLETED";
}) {
  await notify({
    userIds: [opts.publishedById],
    type: NotificationType.MARKETPLACE_PROJECT_STATUS,
    title: opts.scrubbedTitle,
    body:
      opts.next === "IN_PROGRESS"
        ? `A vállalkozó elkezdte a munkát (${opts.ticketTrackingNumber}).`
        : `A vállalkozó készre jelentette a munkát (${opts.ticketTrackingNumber}). Számla feltöltése várható.`,
    entityType: "MaintenanceTicket",
    entityId: opts.ticketId,
  });
}

export async function invoiceWasSubmitted(opts: {
  invoiceId: string;
  publicationId: string;
  publishedById: string;
  scrubbedTitle: string;
  ticketTrackingNumber: string;
  invoiceNumber: string;
  grossAmount: number;
}) {
  await notify({
    userIds: [opts.publishedById],
    type: NotificationType.MARKETPLACE_INVOICE_NEW,
    title: opts.scrubbedTitle,
    body: `Számla érkezett a(z) ${opts.ticketTrackingNumber} munkához: ${opts.invoiceNumber}. Bruttó: ${opts.grossAmount.toLocaleString("hu")} Ft.`,
    entityType: "MarketplaceInvoice",
    entityId: opts.invoiceId,
  });
}

export async function invoiceWasPaid(opts: {
  invoiceId: string;
  buildingId: string;
  paidByUserId: string;
  contractorUserId: string;
  scrubbedTitle: string;
  invoiceNumber: string;
}) {
  await createAuditLog({
    entityType: "MarketplaceInvoice",
    entityId: opts.invoiceId,
    action: "UPDATE",
    userId: opts.paidByUserId,
    buildingId: opts.buildingId,
    oldValue: { status: "PENDING" },
    newValue: { status: "PAID" },
  }).catch(() => undefined);

  await notify({
    contractorUserIds: [opts.contractorUserId],
    type: NotificationType.MARKETPLACE_INVOICE_PAID,
    title: opts.scrubbedTitle,
    body: `A megrendelő kifizettnek jelölte a(z) ${opts.invoiceNumber} számládat. A munka lezárult.`,
    entityType: "MarketplaceInvoice",
    entityId: opts.invoiceId,
  });
}

export async function messageFromContractor(opts: {
  publicationId: string;
  publishedById: string;
  scrubbedTitle: string;
}) {
  await notify({
    userIds: [opts.publishedById],
    type: NotificationType.MARKETPLACE_MESSAGE_CONTRACTOR,
    title: `Új üzenet — ${opts.scrubbedTitle}`,
    body: "A kivitelező új üzenetet írt a hirdetés szálán.",
    entityType: "MarketplacePublication",
    entityId: opts.publicationId,
  });
}

export async function messageFromBoard(opts: {
  publicationId: string;
  bidderOrgId: string;
  scrubbedTitle: string;
}) {
  const owner = await dal.findContractorOrgOwner(opts.bidderOrgId);
  if (!owner) return;
  await notify({
    contractorUserIds: [owner.id],
    type: NotificationType.MARKETPLACE_MESSAGE_BOARD,
    title: `Új üzenet — ${opts.scrubbedTitle}`,
    body: "A megrendelő új üzenetet írt a szálon.",
    entityType: "MarketplacePublication",
    entityId: opts.publicationId,
  });
}
