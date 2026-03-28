import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { contractorId } = body;

    if (!contractorId) {
      return NextResponse.json(
        { error: "Missing required field: contractorId" },
        { status: 400 }
      );
    }

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, status: true, trackingNumber: true, assignedContractorId: true, reporterId: true, title: true, buildingId: true },
    });

    if (!ticket || ticket.buildingId !== buildingId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { id: true, name: true },
    });

    if (!contractor) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    // Auto-transition to ASSIGNED if currently ACKNOWLEDGED
    const updateData: Record<string, unknown> = {
      assignedContractorId: contractorId,
    };

    if (ticket.status === "ACKNOWLEDGED") {
      updateData.status = "ASSIGNED";
    }

    const updated = await prisma.maintenanceTicket.update({
      where: { id },
      data: updateData,
      include: {
        reporter: { select: { id: true, name: true } },
        assignedContractor: { select: { id: true, name: true } },
      },
    });

    const statusChanged = ticket.status === "ACKNOWLEDGED";

    await createAuditLog({
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      action: "UPDATE",
      userId,
      oldValue: {
        assignedContractorId: ticket.assignedContractorId,
        ...(statusChanged ? { status: ticket.status } : {}),
      },
      newValue: {
        assignedContractorId: contractorId,
        contractorName: contractor.name,
        ...(statusChanged ? { status: "ASSIGNED" } : {}),
      },
    });

    // If status auto-changed to ASSIGNED, write a separate status audit entry and notify reporter
    if (statusChanged) {
      await createAuditLog({
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
        action: "UPDATE",
        userId,
        oldValue: { status: ticket.status },
        newValue: { status: "ASSIGNED" },
      });

      await notify({
        userIds: [ticket.reporterId],
        type: NotificationType.MAINTENANCE_STATUS,
        title: `Ticket ${ticket.trackingNumber} assigned`,
        body: `Your ticket "${ticket.title}" has been assigned to ${contractor.name}.`,
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to assign contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
