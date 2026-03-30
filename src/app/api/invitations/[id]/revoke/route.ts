import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/invitations/[id]/revoke
 * Admin only. Revokes a PENDING invitation.
 */
export async function PATCH(
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
    });

    if (!invitation || invitation.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending invitations can be revoked" },
        { status: 400 }
      );
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
