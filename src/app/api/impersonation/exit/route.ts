import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { auditFeatureChange, adminErrorResponse } from "@/lib/admin-feature-guard";

/**
 * POST /api/impersonation/exit — end the current impersonation. Audited as
 * impersonate.end under the REAL superadmin id. Allowlisted in middleware so it
 * works even while the read-only block is active. The client then clears the
 * session (updateSession({ impersonating: null })).
 */
export async function POST() {
  try {
    const ctx = await requireBuildingContext();
    if (ctx.impersonating) {
      await auditFeatureChange({
        userId: ctx.realUserId, // the REAL superadmin
        buildingId: ctx.buildingId,
        action: "impersonate.end",
        entityType: "User",
        entityId: ctx.userId, // the impersonated member
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
