import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { contractorId } = body;

    if (!contractorId) {
      return NextResponse.json(
        { error: "Missing required field: contractorId" },
        { status: 400 }
      );
    }

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, status: true, trackingNumber: true, assignedContractorId: true },
    });

    if (!ticket) {
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

    await createAuditLog({
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      action: "UPDATE",
      userId: user.id,
      oldValue: { assignedContractorId: ticket.assignedContractorId },
      newValue: { assignedContractorId: contractorId, contractorName: contractor.name },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to assign contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
