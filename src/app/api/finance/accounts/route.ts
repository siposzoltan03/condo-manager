import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { allows } from "@/lib/authz";
import { listBuildingAccounts } from "@/lib/finance-dal";

export async function GET() {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json(
          { error: err.message, upgrade: true },
          { status: 403 },
        );
      }
      throw err;
    }

    if (!allows(ctx, "view.building.finance")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const accounts = await listBuildingAccounts(buildingId);
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
