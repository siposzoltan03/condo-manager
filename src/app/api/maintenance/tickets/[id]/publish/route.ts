import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { publishTicketToMarketplace } from "@/lib/marketplace/publishing";
import {
  isPublicationUrgency,
  isBudgetBand,
} from "@/lib/marketplace/category-mapping";
import { sanitizeSpecialties } from "@/lib/contractor/taxonomy";
import { createAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/maintenance/tickets/[id]/publish
 *
 * Board-only. Wraps `publishTicketToMarketplace` with auth + the
 * standard ticket-belongs-to-building check.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  let actor: Awaited<ReturnType<typeof requireBuildingContext>>;
  try {
    actor = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, buildingId } = actor;
  if (!allows(actor, "ticket.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId } = await ctx.params;
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, buildingId: true, publication: { select: { id: true } } },
  });
  if (!ticket || ticket.buildingId !== buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (ticket.publication) {
    return NextResponse.json(
      { error: "Ticket is already published.", publicationId: ticket.publication.id },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        scrubbedTitle?: string;
        scrubbedDescription?: string;
        specialties?: string[];
        urgency?: string;
        budgetBand?: string | null;
        deadlineAt?: string | null;
        revealAddressOnAward?: boolean;
        revealUnitOnAward?: boolean;
        revealOwnerPhoneOnAward?: boolean;
        boardContactEmail?: string;
        boardContactPhone?: string | null;
        acceptAttestation?: boolean;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.acceptAttestation) {
    return NextResponse.json(
      { error: "Legal attestation is required." },
      { status: 400 },
    );
  }
  if (!body.scrubbedTitle || !body.scrubbedDescription) {
    return NextResponse.json(
      { error: "Title and description are required." },
      { status: 400 },
    );
  }
  if (!isPublicationUrgency(body.urgency)) {
    return NextResponse.json({ error: "Invalid urgency." }, { status: 400 });
  }
  if (body.budgetBand && !isBudgetBand(body.budgetBand)) {
    return NextResponse.json({ error: "Invalid budget band." }, { status: 400 });
  }
  const specialties = sanitizeSpecialties(body.specialties);
  if (specialties.length === 0) {
    return NextResponse.json(
      { error: "At least one specialty is required." },
      { status: 400 },
    );
  }
  const budgetBand =
    body.budgetBand && isBudgetBand(body.budgetBand) ? body.budgetBand : null;
  if (!body.boardContactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.boardContactEmail)) {
    return NextResponse.json(
      { error: "Valid board contact email is required." },
      { status: 400 },
    );
  }

  try {
    const pub = await publishTicketToMarketplace({
      ticketId,
      publishedById: userId,
      scrubbedTitle: body.scrubbedTitle,
      scrubbedDescription: body.scrubbedDescription,
      specialties,
      urgency: body.urgency,
      budgetBand,
      deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
      revealAddressOnAward: body.revealAddressOnAward !== false,
      revealUnitOnAward: !!body.revealUnitOnAward,
      revealOwnerPhoneOnAward: !!body.revealOwnerPhoneOnAward,
      boardContactEmail: body.boardContactEmail,
      boardContactPhone: body.boardContactPhone || null,
    });

    await createAuditLog({
      entityType: "MarketplacePublication",
      entityId: pub.id,
      action: "CREATE",
      userId,
      newValue: { ticketId, urgency: body.urgency, specialties },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, publicationId: pub.id });
  } catch (err) {
    console.error("Publish failed:", err);
    const msg = err instanceof Error ? err.message : "Publish failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
