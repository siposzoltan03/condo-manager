import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/subscriptions/[id]/plan
 * SUPER_ADMIN manual plan override. Updates a subscription's plan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: subscriptionId } = await params;
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Verify plan exists and is active
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: "Plan not found or not active" },
        { status: 404 }
      );
    }

    // Verify subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Update subscription plan
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: plan.id,
        // If currently EXPIRED, reactivate
        ...(subscription.subscriptionStatus === "EXPIRED"
          ? { subscriptionStatus: "ACTIVE" }
          : {}),
      },
      include: { plan: true },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        entityType: "Subscription",
        entityId: subscriptionId,
        action: "PLAN_OVERRIDE",
        userId,
        oldValue: { planId: subscription.planId },
        newValue: { planId: plan.id },
        reason: "SUPER_ADMIN manual plan override",
      },
    });

    return NextResponse.json({
      id: updated.id,
      planId: updated.planId,
      planName: updated.plan.name,
      subscriptionStatus: updated.subscriptionStatus,
    });
  } catch (error) {
    console.error("Failed to override subscription plan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
