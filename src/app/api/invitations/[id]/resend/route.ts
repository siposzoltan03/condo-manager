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
      const fullInvitation = await prisma.invitation.findUnique({
        where: { id },
        include: { building: { select: { name: true, invitationExpiryHours: true } } },
      });
      const buildingName = fullInvitation?.building?.name ?? "Condo Manager";
      const roleName = (fullInvitation?.role ?? "RESIDENT").replace("_", " ");
      await sendEmail(
        invitation.email,
        `Reminder: You're invited to join ${buildingName}`,
        `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #002045;">Invitation Reminder</h1>
          <p>You've been invited to join <strong>${buildingName}</strong> as a <strong>${roleName}</strong>.</p>
          <p>Click the button below to set up your account:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" style="background: #002045; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </p>
          <p style="color: #666; font-size: 14px;">This is a new invitation link. Any previous links are no longer valid.</p>
          <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, you can safely ignore it.</p>
        </div>`
      );
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
