import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireCapability } from "@/lib/authz";
import {
  findChargeForBuildingScopedUpdate,
  markChargeAsPaid,
} from "@/lib/finance-dal";
import { chargeMarkedPaid } from "@/lib/finance/events";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

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

    try {
      requireCapability(ctx, "board.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await findChargeForBuildingScopedUpdate(id, buildingId);
    if (!existing) {
      return NextResponse.json({ error: "Charge not found" }, { status: 404 });
    }

    const updated = await markChargeAsPaid(id);

    await chargeMarkedPaid({
      chargeId: id,
      paidByUserId: userId,
      buildingId,
      oldStatus: existing.status,
      oldPaidAt: existing.paidAt,
      newPaidAt: updated.paidAt!,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update charge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
