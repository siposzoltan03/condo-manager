import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/maintenance/tickets/[id]/rate
 *
 * Records a 1–5 rating against the contractor that did the work.
 * Routes to the right column based on how the contractor came in:
 *   - `awardedContractorId` (marketplace org) → `contractorOrgId`
 *   - `assignedContractorId` (legacy directory) → `contractorId`
 *
 * Idempotent per (rater, ticket). Board+ can rate marketplace contractors;
 * the legacy directory path keeps its existing ADMIN floor.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "maintenance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        );
      }
      throw err;
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { rating?: number; notes?: string | null }
      | null;
    const rating = Math.round(Number(body?.rating ?? 0));
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 },
      );
    }
    const notes =
      typeof body?.notes === "string"
        ? body.notes.trim().slice(0, 600)
        : null;

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        buildingId: true,
        assignedContractorId: true,
        awardedContractorId: true,
      },
    });
    if (!ticket || ticket.buildingId !== buildingId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (ticket.status !== "COMPLETED" && ticket.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Ticket must be COMPLETED or VERIFIED to rate contractor" },
        { status: 400 },
      );
    }

    const isMarketplace = !!ticket.awardedContractorId;
    if (!isMarketplace && !ticket.assignedContractorId) {
      return NextResponse.json(
        { error: "No contractor on this ticket" },
        { status: 400 },
      );
    }

    // Role floor: BOARD_MEMBER for marketplace, ADMIN for legacy.
    const minRole = isMarketplace ? "BOARD_MEMBER" : "ADMIN";
    if (!hasMinimumRole(role, minRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetOrgId = ticket.awardedContractorId;
    const targetLegacyId = ticket.assignedContractorId;

    const existing = await prisma.contractorRating.findFirst({
      where: {
        ticketId: ticket.id,
        raterId: userId,
        ...(isMarketplace
          ? { contractorOrgId: targetOrgId! }
          : { contractorId: targetLegacyId! }),
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.contractorRating.update({
        where: { id: existing.id },
        data: { rating, notes: notes || null },
      });
    } else {
      await prisma.contractorRating.create({
        data: {
          rating,
          notes: notes || null,
          ticket: { connect: { id: ticket.id } },
          rater: { connect: { id: userId } },
          ...(isMarketplace
            ? { contractorOrg: { connect: { id: targetOrgId! } } }
            : { contractor: { connect: { id: targetLegacyId! } } }),
        },
      });
    }

    await createAuditLog({
      entityType: "ContractorRating",
      entityId: ticket.id,
      action: existing ? "UPDATE" : "CREATE",
      userId,
      newValue: {
        rating,
        ...(isMarketplace
          ? { contractorOrgId: targetOrgId }
          : { contractorId: targetLegacyId }),
      },
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to rate contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
