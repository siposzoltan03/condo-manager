import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { generateInvitationToken, getInvitationExpiryDate } from "@/lib/invitation";
import { BuildingRole, InvitationStatus } from "@prisma/client";

/**
 * POST /api/invitations
 * Admin sends an invitation to a user to join the active building.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role: inviteeRole, unitId, relationship } = body;

    if (!email || !inviteeRole) {
      return NextResponse.json(
        { error: "Missing required fields: email, role" },
        { status: 400 }
      );
    }

    if (!Object.values(BuildingRole).includes(inviteeRole as BuildingRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user is already a member of this building
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const existingMembership = await prisma.userBuilding.findUnique({
        where: {
          userId_buildingId: {
            userId: existingUser.id,
            buildingId,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this building" },
          { status: 409 }
        );
      }
    }

    // Check for existing PENDING invitation for same email + building
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        buildingId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email. Use resend to send a new link." },
        { status: 409 }
      );
    }

    // Load building for expiry config
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { invitationExpiryHours: true },
    });

    const { raw, hash } = generateInvitationToken();
    const expiresAt = getInvitationExpiryDate(building);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        tokenHash: hash,
        type: "USER_INVITE",
        role: inviteeRole as BuildingRole,
        unitId: unitId || null,
        relationship: relationship || null,
        buildingId,
        invitedById: userId,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        type: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        building: { select: { name: true } },
        unit: { select: { number: true } },
      },
    });

    // Build invite link and send invitation email
    const inviteLink = `${process.env.NEXTAUTH_URL}/accept-invitation/${raw}`;

    // Send email directly (not via queue — invitations are time-sensitive)
    try {
      const { sendEmail } = await import("@/lib/email");
      const buildingName = invitation.building?.name ?? "Condo Manager";
      const roleName = inviteeRole.replace("_", " ");
      await sendEmail(
        email,
        `You're invited to join ${buildingName}`,
        `<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #002045;">You're Invited!</h1>
          <p>You've been invited to join <strong>${buildingName}</strong> as a <strong>${roleName}</strong>.</p>
          <p>Click the button below to set up your account:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" style="background: #002045; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </p>
          <p style="color: #666; font-size: 14px;">This invitation expires in ${invitation.building?.invitationExpiryHours ?? 168} hours.</p>
          <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, you can safely ignore it.</p>
        </div>`
      );
    } catch (emailErr) {
      console.error("Failed to send invitation email:", emailErr);
      // Don't fail the request — invitation is created, email is best-effort
    }

    return NextResponse.json(
      { ...invitation, inviteLink },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invitations
 * List invitations for the active building. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get("status") ?? undefined;

    const where: { buildingId: string; status?: InvitationStatus } = { buildingId };

    if (statusFilter) {
      if (!Object.values(InvitationStatus).includes(statusFilter as InvitationStatus)) {
        return NextResponse.json(
          { error: "Invalid status filter" },
          { status: 400 }
        );
      }
      where.status = statusFilter as InvitationStatus;
    }

    const invitations = await prisma.invitation.findMany({
      where,
      select: {
        id: true,
        email: true,
        type: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
        unit: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Failed to list invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
