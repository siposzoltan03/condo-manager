import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notify, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Acknowledge a board-member resignation. Board+ only, must be a different
 * person than the resigning member. Demotes the role to RESIDENT, removes
 * the resigning user's permission grants, revokes their active sessions
 * (so the next request from any of their devices forces a fresh JWT with
 * the new role), records ACKNOWLEDGED status, and notifies the resigning
 * user.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();
    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const resignation = await prisma.boardResignation.findUnique({
      where: { id },
      include: {
        userBuilding: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!resignation || resignation.userBuilding.buildingId !== buildingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (resignation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Resignation already resolved" },
        { status: 409 },
      );
    }
    if (resignation.userBuilding.userId === userId) {
      return NextResponse.json(
        { error: "Cannot acknowledge your own resignation" },
        { status: 400 },
      );
    }

    const targetUserId = resignation.userBuilding.userId;
    const ubId = resignation.userBuilding.id;

    await prisma.$transaction([
      // Demote role.
      prisma.userBuilding.update({
        where: { id: ubId },
        data: { role: "OWNER" },
      }),
      // Revoke all permission grants — they're no longer a board member.
      prisma.userBuildingPermission.deleteMany({
        where: { userBuildingId: ubId },
      }),
      // Revoke the resigning user's sessions across all devices so the JWT
      // gets re-issued with the new role on next request.
      prisma.userSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // Mark the resignation acknowledged.
      prisma.boardResignation.update({
        where: { id },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          acknowledgedById: userId,
        },
      }),
      // Resolve the matching pending-agenda item (if any). The act of
      // acknowledging *is* the explicit resolution.
      prisma.pendingAgendaItem.updateMany({
        where: { resignationId: id, resolvedAt: null },
        data: {
          resolvedAt: new Date(),
          resolvedById: userId,
          resolutionNote: "A közgyűlés a lemondást elfogadta.",
        },
      }),
    ]);

    await createAuditLog({
      entityType: "BoardResignation",
      entityId: id,
      action: "UPDATE",
      userId,
      buildingId,
      newValue: {
        status: "ACKNOWLEDGED",
        targetUserId,
        oldRole: resignation.userBuilding.role,
        newRole: "OWNER",
      },
    });

    await notify({
      userIds: [targetUserId],
      type: NotificationType.MEETING_RSVP,
      title: "Lemondás elfogadva",
      body: `Képviselői mandátumod a közgyűlés döntésével lezárult. Új szerepkör: tulajdonos.`,
      entityType: "BoardResignation",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to acknowledge resignation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
