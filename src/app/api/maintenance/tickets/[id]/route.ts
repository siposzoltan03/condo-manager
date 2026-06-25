import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { TicketStatus } from "@prisma/client";
import { isValidTransition } from "@/lib/maintenance/tickets";
import {
  findTicketForDetail,
  findTicketForStatusUpdate,
  updateTicketStatus,
} from "@/lib/maintenance-dal";
import { ticketStatusChanged } from "@/lib/maintenance/events";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
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
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const ticket = await findTicketForDetail({
      id,
      buildingId,
      includeInternalComments: isBoardPlus,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Non-board users can only see their own tickets.
    if (!isBoardPlus && ticket.reporterId !== userId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Failed to fetch maintenance ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 },
      );
    }
    if (!Object.values(TicketStatus).includes(status as TicketStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const ticket = await findTicketForStatusUpdate({ id, buildingId });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (!isValidTransition(ticket.status, status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${ticket.status} to ${status}`,
        },
        { status: 400 },
      );
    }

    const oldStatus = ticket.status;
    const updated = await updateTicketStatus({
      id,
      status: status as TicketStatus,
    });

    await ticketStatusChanged({
      ticketId: ticket.id,
      buildingId,
      updatedByUserId: userId,
      reporterUserId: ticket.reporterId,
      trackingNumber: ticket.trackingNumber,
      oldStatus,
      newStatus: status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update maintenance ticket:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
