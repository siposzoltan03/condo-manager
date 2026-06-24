import { NextResponse } from "next/server";
import { getFeatureCatalog } from "@/lib/feature-access";
import { requireSuperAdmin, adminErrorResponse } from "@/lib/admin-feature-guard";

/** GET /api/admin/features — catalog + global flags + plan inclusion. */
export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ features: await getFeatureCatalog() });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
