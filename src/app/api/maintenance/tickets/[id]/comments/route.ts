import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

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

    // Verify ticket exists and user has access
    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, reporterId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (!isBoardPlus && ticket.reporterId !== user.id) {
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const isBoardPlus = hasMinimumRole(user.role, "BOARD_MEMBER");

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      select: { id: true, reporterId: true, trackingNumber: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (!isBoardPlus && ticket.reporterId !== user.id) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Non-board users cannot create internal comments
    const commentIsInternal = isBoardPlus ? (isInternal ?? false) : false;

    const comment = await prisma.ticketComment.create({
      data: {
        body: commentBody.trim(),
        isInternal: commentIsInternal,
        ticket: { connect: { id } },
        author: { connect: { id: user.id } },
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    // Notify reporter if someone else adds a non-internal comment
    if (!commentIsInternal && ticket.reporterId !== user.id) {
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
    if (ticket.reporterId === user.id && !commentIsInternal) {
      const boardMembers = await prisma.user.findMany({
        where: {
          role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] },
          isActive: true,
          id: { not: user.id },
        },
        select: { id: true },
      });

      if (boardMembers.length > 0) {
        await notify({
          userIds: boardMembers.map((m) => m.id),
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
