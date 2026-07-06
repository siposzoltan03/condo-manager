import { NextResponse } from "next/server";
import { getFeatureAuditLog } from "@/lib/feature-access";
import { requireSuperAdmin, adminErrorResponse } from "@/lib/admin-feature-guard";

/** GET /api/admin/features/audit — recent feature-management audit trail. */
export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ entries: await getFeatureAuditLog() });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
