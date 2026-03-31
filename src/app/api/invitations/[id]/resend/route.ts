import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { generateInvitationToken, getInvitationExpiryDate } from "@/lib/invitation";

/**
 * POST /api/invitations/[id]/resend
 * Admin only. Generates a new token for a PENDING invitation,
 * invalidating the old link.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      include: { building: { select: { invitationExpiryHours: true } } },
    });

    if (!invitation || invitation.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending invitations can be resent" },
        { status: 400 }
      );
    }

    const { raw, hash } = generateInvitationToken();
    const expiresAt = getInvitationExpiryDate(invitation.building);

    await prisma.invitation.update({
      where: { id },
      data: {
        tokenHash: hash,
        expiresAt,
      },
    });

    // Build new invite link and send email
    const inviteLink = `${process.env.NEXTAUTH_URL}/accept-invitation/${raw}`;

    try {
      const { sendEmail } = await import("@/lib/email");
      const { invitationResendEmail } = await import("@/lib/email-templates");
      const fullInvitation = await prisma.invitation.findUnique({
        where: { id },
        include: { building: { select: { name: true, invitationExpiryHours: true } } },
      });
      const buildingName = fullInvitation?.building?.name ?? "Condo Manager";
      const roleName = (fullInvitation?.role ?? "RESIDENT").replace("_", " ");
      const expiryHours = fullInvitation?.building?.invitationExpiryHours ?? 168;
      const { subject, html } = invitationResendEmail({
        buildingName,
        roleName,
        inviteLink,
        expiryHours,
      });
      await sendEmail(invitation.email, subject, html);
    } catch (emailErr) {
      console.error("Failed to send resend email:", emailErr);
    }

    return NextResponse.json({ success: true, inviteLink });
  } catch (error) {
    console.error("Failed to resend invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
