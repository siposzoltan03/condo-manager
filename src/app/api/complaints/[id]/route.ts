import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { ComplaintStatus } from "@prisma/client";

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

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true },
        },
        notes: {
          where: isBoardPlus ? {} : { isInternal: false },
          include: {
            author: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    // Check visibility: private complaints only visible to author + BOARD_MEMBER+
    if (complaint.isPrivate && complaint.authorId !== user.id && !isBoardPlus) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    return NextResponse.json(complaint);
  } catch (error) {
    console.error("Failed to fetch complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    if (!Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, status: true, authorId: true, trackingNumber: true },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    const oldStatus = complaint.status;

    const updated = await prisma.complaint.update({
      where: { id },
      data: { status: status as ComplaintStatus },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      entityType: "Complaint",
      entityId: complaint.id,
      action: "UPDATE",
      userId: user.id,
      oldValue: { status: oldStatus },
      newValue: { status },
    });

    // Notify complaint author on status change
    if (oldStatus !== status) {
      await notify({
        userIds: [complaint.authorId],
        type: NotificationType.COMPLAINT_STATUS,
        title: "Complaint Status Updated",
        body: `Your complaint ${complaint.trackingNumber} status changed from ${oldStatus} to ${status}`,
        entityType: "Complaint",
        entityId: complaint.id,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
