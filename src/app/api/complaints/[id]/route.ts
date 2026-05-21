import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import {
  updateComplaintStatus,
  type NewMeetingInput,
} from "@/app/actions/complaints";
import { findComplaintForViewer } from "@/lib/complaints-dal";
import { ComplaintStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { id } = await context.params;
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const complaint = await findComplaintForViewer({
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

    return NextResponse.json(complaint);
  } catch (error) {
    console.error("Failed to fetch complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, note, escalatedMeetingId, newMeeting } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 },
      );
    }
    if (!Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await updateComplaintStatus(
      id,
      status as ComplaintStatus,
      typeof note === "string" ? note : undefined,
      typeof escalatedMeetingId === "string" ? escalatedMeetingId : undefined,
      newMeeting && typeof newMeeting === "object"
        ? (newMeeting as NewMeetingInput)
        : undefined,
    );
    if (result.error) {
      const code =
        result.error === "Forbidden"
          ? 403
          : result.error === "Complaint not found"
            ? 404
            : result.error.startsWith("Cannot transition")
              ? 409
              : 400;
      return NextResponse.json({ error: result.error }, { status: code });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update complaint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
