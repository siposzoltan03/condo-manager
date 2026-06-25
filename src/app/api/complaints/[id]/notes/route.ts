import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import {
  findComplaintForAccess,
  listComplaintNotes,
  createComplaintNote,
  listBuildingBoardMemberIds,
} from "@/lib/complaints-dal";
import {
  complaintNoteAddedByOther,
  complaintNoteAddedByAuthor,
} from "@/lib/complaints/events";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    const { id } = await context.params;
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const complaint = await findComplaintForAccess({
      id,
      buildingId,
      viewerUserId: userId,
      isBoardPlus,
    });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 },
      );
    }

    const notes = await listComplaintNotes({
      complaintId: id,
      includeInternal: isBoardPlus,
    });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Failed to fetch complaint notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    const { id } = await context.params;
    const reqBody = await request.json();
    const { body: noteBody, isInternal } = reqBody;

    if (
      !noteBody ||
      typeof noteBody !== "string" ||
      noteBody.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required field: body" },
        { status: 400 },
      );
    }

    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
    const complaint = await findComplaintForAccess({
      id,
      buildingId,
      viewerUserId: userId,
      isBoardPlus,
    });
    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 },
      );
    }

    // Non-board users can't post internal notes.
    const noteIsInternal = isBoardPlus ? (isInternal ?? false) : false;

    const note = await createComplaintNote({
      complaintId: id,
      authorId: userId,
      body: noteBody.trim(),
      isInternal: noteIsInternal,
    });

    if (!noteIsInternal) {
      if (complaint.authorId !== userId) {
        await complaintNoteAddedByOther({
          complaintId: complaint.id,
          trackingNumber: complaint.trackingNumber,
          authorUserId: complaint.authorId,
        });
      } else {
        const boardMemberIds = await listBuildingBoardMemberIds(
          buildingId,
          userId,
        );
        await complaintNoteAddedByAuthor({
          complaintId: complaint.id,
          trackingNumber: complaint.trackingNumber,
          boardMemberUserIds: boardMemberIds,
        });
      }
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Failed to add complaint note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
