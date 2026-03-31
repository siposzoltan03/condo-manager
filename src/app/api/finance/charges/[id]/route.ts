import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { requireRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "finance");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.monthlyCharge.findUnique({
      where: { id },
      include: { unit: { select: { buildingId: true } } },
    });

    if (!existing || existing.unit.buildingId !== buildingId) {
      return NextResponse.json({ error: "Charge not found" }, { status: 404 });
    }

    const updated = await prisma.monthlyCharge.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
      include: {
        unit: {
          select: { number: true },
        },
      },
    });

    await createAuditLog({
      entityType: "MonthlyCharge",
      entityId: id,
      action: "UPDATE",
      userId,
      oldValue: { status: existing.status, paidAt: existing.paidAt },
      newValue: { status: updated.status, paidAt: updated.paidAt },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update charge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
