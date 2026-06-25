import type {
  MaintenanceTicket,
  Unit,
  UnitUser,
  User,
  PrismaClient,
} from "@prisma/client";

/**
 * Phase 5 — GDPR Art. 5(1)(c) data-minimization + Art. 28 vendor
 * (adatfeldolgozó) boundary. The plan's principle: vendors see the
 * minimum metadata needed to perform a service. Pre-award (marketplace
 * listings), the vendor sees no resident names. Post-award, the winning
 * contractor sees the location label and a masked phone routed through
 * the platform.
 *
 * Used by any surface that renders ticket data to an external party
 * (current vendor-portal is a non-goal of this plan; preventive helper).
 */

export interface AnonymizedTicketView {
  id: string;
  trackingNumber: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  /** Synthesised location: "A · 4. em · 3", never the resident's name. */
  unitLabel: string;
  /** First name only — and only when the vendor genuinely needs entry. */
  contactFirstName: string | null;
  /** Last 4 digits, e.g. "•• ••• ••42", or null. Routed through platform. */
  contactPhoneMasked: string | null;
}

function buildUnitLabel(unit: Pick<Unit, "number" | "floor" | "stairwell">): string {
  const parts: string[] = [];
  if (unit.stairwell) parts.push(unit.stairwell);
  if (unit.floor !== null && unit.floor !== undefined) {
    parts.push(`${unit.floor}. em`);
  }
  parts.push(unit.number);
  return parts.join(" · ");
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•• ••• ••••";
  return `•• ••• ••${digits.slice(-2)}`;
}

export function anonymizeTicketForVendor(args: {
  ticket: Pick<
    MaintenanceTicket,
    "id" | "title" | "description" | "category" | "urgency" | "status"
  > & { trackingNumber?: string | null };
  unit: Pick<Unit, "number" | "floor" | "stairwell">;
  primaryContact:
    | (Pick<UnitUser, "id"> & { user: Pick<User, "name"> })
    | null;
  contactPhone: string | null;
  needsEntry: boolean;
}): AnonymizedTicketView {
  const firstName =
    args.needsEntry && args.primaryContact?.user.name
      ? args.primaryContact.user.name.split(" ")[0] ?? null
      : null;
  return {
    id: args.ticket.id,
    trackingNumber: args.ticket.trackingNumber ?? args.ticket.id.slice(-8).toUpperCase(),
    title: args.ticket.title,
    description: args.ticket.description ?? "",
    category: args.ticket.category as unknown as string,
    urgency: args.ticket.urgency as unknown as string,
    status: args.ticket.status as unknown as string,
    unitLabel: buildUnitLabel(args.unit),
    contactFirstName: firstName,
    contactPhoneMasked: args.needsEntry ? maskPhone(args.contactPhone) : null,
  };
}

/**
 * GDPR Art. 28 — ticket assignment to a Contractor is blocked when the
 * contractor has no Data Processing Agreement on file. Call this from
 * the ticket-assign action; throw if it returns false.
 */
export async function contractorHasDpa(
  prisma: Pick<PrismaClient, "contractor">,
  contractorId: string,
): Promise<boolean> {
  const c = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { dataProcessingAgreementDocumentId: true },
  });
  return !!c?.dataProcessingAgreementDocumentId;
}
