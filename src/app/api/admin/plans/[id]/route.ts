import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireSuperAdmin,
  adminErrorResponse,
  auditFeatureChange,
} from "@/lib/admin-feature-guard";

const BodySchema = z.object({
  maxBuildings: z.number().int().min(0).optional(),
  maxUnitsPerBuilding: z.number().int().min(0).optional(),
  priceMonthly: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  priceYearly: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  trialDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  stripePriceId: z.string().nullable().optional(),
});

/** PATCH /api/admin/plans/[id] — edit plan limits & pricing. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, buildingId } = await requireSuperAdmin();
    const { id } = await params;
    const body = BodySchema.parse(await request.json());

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const updated = await prisma.plan.update({ where: { id }, data: body });

    await auditFeatureChange({
      userId,
      buildingId,
      action: "plan.limits.update",
      entityType: "Plan",
      entityId: id,
      oldValue: {
        maxBuildings: plan.maxBuildings,
        maxUnitsPerBuilding: plan.maxUnitsPerBuilding,
        priceMonthly: plan.priceMonthly.toString(),
        priceYearly: plan.priceYearly.toString(),
        trialDays: plan.trialDays,
        isActive: plan.isActive,
        stripePriceId: plan.stripePriceId,
      },
      newValue: body,
    });

    return NextResponse.json({ ok: true, isActive: updated.isActive });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: error.issues }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
