import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";
import { isValidTransition } from "@/lib/maintenance/tickets";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const isBoardPlus = hasMinimumRole(user.role, "BOARD_MEMBER");

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, name: true } },
        assignedContractor: true,
        attachments: { orderBy: { createdAt: "asc" } },
        comments: {
          where: isBoardPlus ? {} : { isInternal: false },
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        ratings: {
          include: {
            rater: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Non-board users can only see their own tickets
    if (!isBoardPlus && ticket.reporterId !== user.id) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Failed to fetch maintenance ticket:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 }
      );
    }

    if (!Object.values(TicketStatus).includes(status as TicketStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, status: true, reporterId: true, trackingNumber: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (!isValidTransition(ticket.status, status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${ticket.status} to ${status}` },
        { status: 400 }
      );
    }

    const oldStatus = ticket.status;

    const updated = await prisma.maintenanceTicket.update({
      where: { id },
      data: { status: status as TicketStatus },
      include: {
        reporter: { select: { id: true, name: true } },
        assignedContractor: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      action: "UPDATE",
      userId: user.id,
      oldValue: { status: oldStatus },
      newValue: { status },
    });

    // Notify reporter on status change
    if (oldStatus !== status) {
      await notify({
        userIds: [ticket.reporterId],
        type: NotificationType.MAINTENANCE_STATUS,
        title: "Maintenance Ticket Updated",
        body: `Your ticket ${ticket.trackingNumber} status changed from ${oldStatus} to ${status}`,
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update maintenance ticket:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
