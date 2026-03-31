import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "maintenance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id } = await context.params;
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    // Verify ticket exists and belongs to building
    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, reporterId: true, buildingId: true },
    });

    if (!ticket || ticket.buildingId !== buildingId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (!isBoardPlus && ticket.reporterId !== userId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const comments = await prisma.ticketComment.findMany({
      where: {
        ticketId: id,
        ...(isBoardPlus ? {} : { isInternal: false }),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to fetch ticket comments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "maintenance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const { id } = await context.params;
    const reqBody = await request.json();
    const { body: commentBody, isInternal } = reqBody;

    if (!commentBody || typeof commentBody !== "string" || commentBody.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: body" },
        { status: 400 }
      );
    }

    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, reporterId: true, trackingNumber: true, buildingId: true },
    });

    if (!ticket || ticket.buildingId !== buildingId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (!isBoardPlus && ticket.reporterId !== userId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Non-board users cannot create internal comments
    const commentIsInternal = isBoardPlus ? (isInternal ?? false) : false;

    const comment = await prisma.ticketComment.create({
      data: {
        body: commentBody.trim(),
        isInternal: commentIsInternal,
        ticket: { connect: { id } },
        author: { connect: { id: userId } },
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    // Notify reporter if someone else adds a non-internal comment
    if (!commentIsInternal && ticket.reporterId !== userId) {
      await notify({
        userIds: [ticket.reporterId],
        type: NotificationType.MAINTENANCE_STATUS,
        title: "New Comment on Your Ticket",
        body: `A new comment was added to your ticket ${ticket.trackingNumber}`,
        entityType: "MaintenanceTicket",
        entityId: ticket.id,
      });
    }

    // If the reporter adds a comment, notify board members
    if (ticket.reporterId === userId && !commentIsInternal) {
      const boardMembers = await prisma.userBuilding.findMany({
        where: {
          buildingId,
          role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
          userId: { not: userId },
        },
        select: { userId: true },
      });

      if (boardMembers.length > 0) {
        await notify({
          userIds: boardMembers.map((m) => m.userId),
          type: NotificationType.MAINTENANCE_STATUS,
          title: "New Comment on Maintenance Ticket",
          body: `A new comment was added to ticket ${ticket.trackingNumber}`,
          entityType: "MaintenanceTicket",
          entityId: ticket.id,
        });
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to add ticket comment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
