import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSuperAdmin,
  adminErrorResponse,
  auditFeatureChange,
} from "@/lib/admin-feature-guard";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  buildingId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * POST /api/impersonation/start — begin a read-only impersonation. A SUPER_ADMIN
 * picks a member of a building; we compute that member's effective flags (the
 * same way login hydrates them) and return the impersonation context, which the
 * client writes onto the session. Audited as impersonate.start under the REAL
 * superadmin id. Read-only is enforced globally by middleware.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireSuperAdmin();
    if (!allows(ctx, "platform.impersonate")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { buildingId, userId } = BodySchema.parse(await request.json());

    const membership = await prisma.userBuilding.findUnique({
      where: { userId_buildingId: { userId, buildingId } },
      include: {
        building: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });
    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: "User is not an active member of this building" },
        { status: 404 },
      );
    }

    // Compute the target's flags exactly like login hydration.
    const [ownsCount, auditCount] = await Promise.all([
      prisma.unitUser.count({
        where: { userId, relationship: "OWNER", unit: { buildingId } },
      }),
      prisma.auditorMembership.count({
        where: { userId, buildingId, endedAt: null },
      }),
    ]);

    const impersonating = {
      userId: membership.user.id,
      userName: membership.user.name ?? "",
      buildingId: membership.building.id,
      buildingName: membership.building.name,
      role: membership.role,
      isChair: membership.isChair,
      ownsAnyUnit: ownsCount > 0,
      isAuditor: auditCount > 0,
    };

    await auditFeatureChange({
      userId: ctx.userId, // the REAL superadmin
      buildingId,
      action: "impersonate.start",
      entityType: "User",
      entityId: userId,
      newValue: { role: membership.role, buildingId },
    });

    return NextResponse.json(impersonating);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
