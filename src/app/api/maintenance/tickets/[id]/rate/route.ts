import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
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

    if (!hasMinimumRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { rating, notes } = body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, status: true, assignedContractorId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status !== "COMPLETED" && ticket.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Ticket must be COMPLETED or VERIFIED to rate contractor" },
        { status: 400 }
      );
    }

    if (!ticket.assignedContractorId) {
      return NextResponse.json(
        { error: "No contractor assigned to this ticket" },
        { status: 400 }
      );
    }

    const contractorRating = await prisma.contractorRating.create({
      data: {
        rating,
        notes: notes ?? null,
        contractor: { connect: { id: ticket.assignedContractorId } },
        ticket: { connect: { id: ticket.id } },
        rater: { connect: { id: user.id } },
      },
      include: {
        rater: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(contractorRating, { status: 201 });
  } catch (error) {
    console.error("Failed to rate contractor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
