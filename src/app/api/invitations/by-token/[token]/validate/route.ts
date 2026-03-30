import { NextRequest, NextResponse } from "next/server";
import { findInvitationByToken, isInvitationExpired } from "@/lib/invitation";

/**
 * GET /api/invitations/[token]/validate
 * Public endpoint. Validates an invitation token and returns pre-fill data
 * for the accept form (email, type, role, building name, unit number).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await findInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 404 }
      );
    }

    if (isInvitationExpired(invitation)) {
      const statusMessage =
        invitation.status === "ACCEPTED"
          ? "This invitation has already been accepted"
          : invitation.status === "REVOKED"
            ? "This invitation has been revoked"
            : "This invitation has expired";
      return NextResponse.json(
        { error: statusMessage, status: invitation.status },
        { status: 410 }
      );
    }

    return NextResponse.json({
      email: invitation.email,
      type: invitation.type,
      role: invitation.role,
      buildingName: invitation.building?.name ?? null,
      unitNumber: invitation.unit?.number ?? null,
    });
  } catch (error) {
    console.error("Failed to validate invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
