import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { closePublication } from "@/lib/marketplace/publishing";
import { createAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/maintenance/tickets/[id]/publish/close
 *
 * Board-only. Closes an OPEN marketplace publication without picking a
 * winner. Existing bids stay where they are — the award flow in Phase 4
 * handles bid-side lifecycle.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  let userId: string;
  let buildingId: string;
  let role: string;
  try {
    ({ userId, buildingId, role } = await requireBuildingContext());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinimumRole(role, "BOARD_MEMBER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: ticketId } = await ctx.params;
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      buildingId: true,
      publication: { select: { id: true, status: true } },
    },
  });
  if (!ticket || ticket.buildingId !== buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!ticket.publication) {
    return NextResponse.json(
      { error: "No publication for this ticket." },
      { status: 400 },
    );
  }
  if (ticket.publication.status !== "OPEN") {
    return NextResponse.json(
      { error: "Publication is not OPEN." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { reason?: string }
    | null;
  const reason = body?.reason?.trim() ?? "";

  await closePublication(ticket.publication.id, reason);
  await createAuditLog({
    entityType: "MarketplacePublication",
    entityId: ticket.publication.id,
    action: "UPDATE",
    userId,
    newValue: { status: "CLOSED", reason },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
