import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getContractorWithStats } from "@/lib/maintenance/contractors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const contractor = await getContractorWithStats(id);

    if (!contractor) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    return NextResponse.json(contractor);
  } catch (error) {
    console.error("Failed to fetch contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, specialty, contactInfo, taxId } = body;

    const existing = await prisma.contractor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    const updated = await prisma.contractor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(specialty !== undefined && { specialty }),
        ...(contactInfo !== undefined && { contactInfo }),
        ...(taxId !== undefined && { taxId }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinimumRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.contractor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
    }

    // Check if contractor has assigned tickets
    const assignedTickets = await prisma.maintenanceTicket.count({
      where: { assignedContractorId: id },
    });

    if (assignedTickets > 0) {
      return NextResponse.json(
        { error: "Cannot delete contractor with assigned tickets" },
        { status: 400 }
      );
    }

    await prisma.contractor.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
