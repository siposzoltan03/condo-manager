import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { contractorHasDpa } from "@/lib/vendor-anonymizer";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      await requireFeature(buildingId, "maintenance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    if (!allows(ctx, "ticket.assign")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const rawContractorId = body?.contractorId;

    // Allow `null` to mean "unassign". Treat undefined as missing.
    if (rawContractorId === undefined) {
      return NextResponse.json(
        { error: "Missing field: contractorId (use null to unassign)" },
        { status: 400 }
      );
    }
    const contractorId: string | null = rawContractorId;

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        assignedContractorId: true,
        reporterId: true,
        title: true,
        buildingId: true,
      },
    });

    if (!ticket || ticket.buildingId !== buildingId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // ── Unassign branch ────────────────────────────────────────────────────
    if (contractorId === null) {
      if (ticket.status === "COMPLETED" || ticket.status === "VERIFIED") {
        return NextResponse.json(
          { error: "Cannot unassign a closed ticket" },
          { status: 400 }
        );
      }
      if (ticket.assignedContractorId === null) {
        return NextResponse.json({ error: "Ticket is not assigned" }, { status: 400 });
      }

      // Revert ASSIGNED / IN_PROGRESS to ACKNOWLEDGED. Leave SUBMITTED /
      // ACKNOWLEDGED untouched (the field is just being cleared).
      const shouldRevertStatus =
        ticket.status === "ASSIGNED" || ticket.status === "IN_PROGRESS";

      const updated = await prisma.maintenanceTicket.update({
        where: { id },
        data: {
          assignedContractorId: null,
          ...(shouldRevertStatus ? { status: "ACKNOWLEDGED" as const } : {}),
        },
        include: {
          reporter: { select: { id: true, name: true } },
          assignedContractor: { select: { id: true, name: true } },
        },
      });

      await createAuditLog({
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
        action: "UPDATE",
        userId,
      buildingId,
        oldValue: {
          assignedContractorId: ticket.assignedContractorId,
          ...(shouldRevertStatus ? { status: ticket.status } : {}),
        },
        newValue: {
          assignedContractorId: null,
          ...(shouldRevertStatus ? { status: "ACKNOWLEDGED" } : {}),
        },
      });

      if (shouldRevertStatus) {
        await notify({
          userIds: [ticket.reporterId],
          type: NotificationType.MAINTENANCE_STATUS,
          title: `Ticket ${ticket.trackingNumber} reverted`,
          body: `The contractor was unassigned from "${ticket.title}". Status reverted to acknowledged.`,
          entityType: "MaintenanceTicket",
          entityId: ticket.id,
        });
      }

      return NextResponse.json(updated);
    }

    // ── Assign branch ──────────────────────────────────────────────────────
    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { id: true, name: true },
    });

    if (!contractor) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    // Phase 5 (GDPR Art. 28) — refuse assignment to a Contractor with
    // no Data Processing Agreement on file. The DPA is the legal basis
    // under which the contractor is permitted to process resident PII
    // visible in the ticket (location label, contact phone, photos).
    // Without it, the building risks an Art. 28 violation the moment
    // the contractor reads the ticket.
    const hasDpa = await contractorHasDpa(prisma, contractorId);
    if (!hasDpa) {
      return NextResponse.json(
        {
          error: "Contractor has no Data Processing Agreement on file (GDPR Art. 28). Upload a DPA before assigning tickets.",
          code: "DPA_MISSING",
        },
        { status: 422 },
      );
    }

    // Auto-transition to ASSIGNED if currently ACKNOWLEDGED.
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
      buildingId,
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

    if (statusChanged) {
      await createAuditLog({
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
        action: "UPDATE",
        userId,
      buildingId,
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
