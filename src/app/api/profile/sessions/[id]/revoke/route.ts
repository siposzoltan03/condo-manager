import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { revokeSession } from "@/lib/sessions";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/profile/sessions/[id]/revoke
 *
 * Revoke a UserSession owned by the calling user. The next request from
 * that device will be bounced to login (the JWT validation hook checks
 * the row).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await requireBuildingContext();
    const { id } = await context.params;
    const ok = await revokeSession(id, userId);
    if (!ok) {
      return NextResponse.json(
        { error: "Session not found or already revoked" },
        { status: 404 },
      );
    }
    await createAuditLog({
      entityType: "UserSession",
      entityId: id,
      action: "DELETE",
      userId,
      newValue: { revoked: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to revoke session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
