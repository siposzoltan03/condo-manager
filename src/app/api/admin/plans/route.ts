import { NextResponse } from "next/server";
import { getPlanMatrix } from "@/lib/feature-access";
import { requireSuperAdmin, adminErrorResponse } from "@/lib/admin-feature-guard";

/** GET /api/admin/plans — plan list + feature matrix + limits/pricing. */
export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json(await getPlanMatrix());
  } catch (error) {
    return adminErrorResponse(error);
  }
}
