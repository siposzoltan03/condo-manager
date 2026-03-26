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

    // Verify complaint exists and user has access
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, isPrivate: true, authorId: true },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    if (complaint.isPrivate && complaint.authorId !== user.id && !isBoardPlus) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    const notes = await prisma.complaintNote.findMany({
      where: {
        complaintId: id,
        ...(isBoardPlus ? {} : { isInternal: false }),
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Failed to fetch complaint notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    const { body: noteBody, isInternal } = reqBody;

    if (!noteBody || typeof noteBody !== "string" || noteBody.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: body" },
        { status: 400 }
      );
    }

    const isBoardPlus = hasMinimumRole(user.role, "BOARD_MEMBER");

    // Verify complaint exists and user has access
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, isPrivate: true, authorId: true, trackingNumber: true },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    if (complaint.isPrivate && complaint.authorId !== user.id && !isBoardPlus) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    // Non-board users: isInternal forced to false
    const noteIsInternal = isBoardPlus ? (isInternal ?? false) : false;

    const note = await prisma.complaintNote.create({
      data: {
        body: noteBody.trim(),
        isInternal: noteIsInternal,
        complaint: { connect: { id } },
        author: { connect: { id: user.id } },
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });

    // Notify complaint author if someone else adds a note (and it's not internal)
    if (!noteIsInternal && complaint.authorId !== user.id) {
      await notify({
        userIds: [complaint.authorId],
        type: NotificationType.COMPLAINT_STATUS,
        title: "New Note on Your Complaint",
        body: `A new note was added to your complaint ${complaint.trackingNumber}`,
        entityType: "Complaint",
        entityId: complaint.id,
      });
    }

    // If the author adds a note, notify board members
    if (complaint.authorId === user.id && !noteIsInternal) {
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
          type: NotificationType.COMPLAINT_STATUS,
          title: "New Note on Complaint",
          body: `A new note was added to complaint ${complaint.trackingNumber}`,
          entityType: "Complaint",
          entityId: complaint.id,
        });
      }
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Failed to add complaint note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
