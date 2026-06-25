import * as dal from "./dal";
import {
  sanitizeSpecialties,
  type SpecialtySlug,
} from "@/lib/contractor/taxonomy";
import {
  isPublicationUrgency,
  isBudgetBand,
  type BudgetBand,
  type PublicationUrgency,
} from "./category-mapping";

/**
 * Marketplace publishing — the *only* writer of `MarketplacePublication`.
 *
 * Scrubbing is frozen at publish time: the contractor side reads from
 * the publication row only and never joins back to `MaintenanceTicket`.
 * That keeps the privacy boundary surgical — even if a ticket gets new
 * comments or its description changes, the listing stays at the
 * snapshot the board approved.
 */

export interface PublishInput {
  ticketId: string;
  publishedById: string;
  scrubbedTitle: string;
  scrubbedDescription: string;
  /** Default = contractor specialty matching the ticket category. */
  specialties: SpecialtySlug[];
  urgency: PublicationUrgency;
  budgetBand: BudgetBand | null;
  /** Bid deadline. If unset, defaults to 14 days from publish. */
  deadlineAt: Date | null;
  /** Privacy toggles — decided per publication, not globally. */
  revealAddressOnAward: boolean;
  revealUnitOnAward: boolean;
  revealOwnerPhoneOnAward: boolean;
  /** Board contact surfaced to the winning bidder. */
  boardContactEmail: string;
  boardContactPhone: string | null;
}

export interface PublishedResult {
  id: string;
  ticketId: string;
  status: "OPEN";
}

export async function publishTicketToMarketplace(
  input: PublishInput,
): Promise<PublishedResult> {
  if (!input.scrubbedTitle.trim() || !input.scrubbedDescription.trim()) {
    throw new Error("Title and description are required.");
  }
  if (!isPublicationUrgency(input.urgency)) {
    throw new Error("Invalid urgency.");
  }
  if (input.budgetBand !== null && !isBudgetBand(input.budgetBand)) {
    throw new Error("Invalid budget band.");
  }
  const specialties = sanitizeSpecialties(input.specialties);
  if (specialties.length === 0) {
    throw new Error("At least one specialty is required.");
  }

  // Pull just what we need from the ticket + its building. We snapshot
  // city/zip into the publication so a later building rename can't
  // silently change historical aggregates.
  const ticket = await dal.findTicketForPublishingSnapshot(input.ticketId);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.publication) {
    // Idempotency: re-publish on an already-published ticket is a no-op.
    return {
      id: ticket.publication.id,
      ticketId: ticket.id,
      status: "OPEN",
    };
  }
  if (ticket.status === "SUBMITTED") {
    throw new Error("Ticket must be acknowledged before publishing.");
  }

  // Snapshot the publisher's display name so the listing stays
  // meaningful even after the user leaves the board.
  const publisher = await dal.findUserNameById(input.publishedById);
  if (!publisher) throw new Error("Publisher not found.");

  const deadlineAt =
    input.deadlineAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const pub = await dal.createPublication({
    ticketId: ticket.id,
    scrubbedTitle: input.scrubbedTitle.trim(),
    scrubbedDescription: input.scrubbedDescription.trim(),
    category: ticket.category,
    urgency: input.urgency,
    city: ticket.building.city,
    zip: ticket.building.zipCode,
    budgetBand: input.budgetBand,
    deadlineAt,
    specialties,
    revealAddressOnAward: input.revealAddressOnAward,
    revealUnitOnAward: input.revealUnitOnAward,
    revealOwnerPhoneOnAward: input.revealOwnerPhoneOnAward,
    boardContactEmail: input.boardContactEmail,
    boardContactPhone: input.boardContactPhone,
    publishedById: input.publishedById,
    publisherDisplayName: publisher.name,
  });

  return { id: pub.id, ticketId: pub.ticketId, status: "OPEN" };
}

/**
 * Board-side closure without picking a winner. Sets the publication to
 * `CLOSED` with a reason; existing bids are NOT auto-rejected here
 * (Phase 4's award flow handles bid lifecycle). The condo's
 * `MaintenanceTicket` is untouched — board can still finish the work
 * with someone outside the marketplace.
 */
export async function closePublication(
  publicationId: string,
  reason: string,
): Promise<void> {
  await dal.setPublicationClosed(publicationId, reason || null);
}

/**
 * Contractor-facing query. Returns only OPEN publications and only
 * fields safe to expose. Filtering is server-side so a malformed
 * filter can't widen the result set.
 */
export interface OpenPublicationsFilter {
  /** Limit to publications matching at least one of these specialties. */
  specialties?: SpecialtySlug[];
  /** Limit to a fixed city. */
  city?: string;
  /** Limit to publications posted in the trailing N days. */
  postedWithinDays?: number;
  /** Skip publications already bid by this contractor org. */
  excludeBidByOrgId?: string;
  take?: number;
}

export async function getOpenPublications(filter: OpenPublicationsFilter = {}) {
  const rows = await dal.findOpenPublications({
    city: filter.city,
    postedWithinDays: filter.postedWithinDays,
    excludeBidByOrgId: filter.excludeBidByOrgId,
    take: filter.take,
  });

  // Specialty filter is a JSON array — Prisma's `array_contains` is
  // limited cross-db, so we filter in app code. Keeps the query simple.
  if (filter.specialties && filter.specialties.length > 0) {
    const wanted = new Set(filter.specialties);
    return rows.filter((p) => {
      const list = Array.isArray(p.specialties) ? (p.specialties as string[]) : [];
      return list.some((s) => wanted.has(s as SpecialtySlug));
    });
  }
  return rows;
}

export async function getPublicationByTicket(ticketId: string) {
  return dal.findPublicationByTicketId(ticketId);
}
