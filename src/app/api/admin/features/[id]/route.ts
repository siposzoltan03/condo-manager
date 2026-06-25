import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireSuperAdmin,
  adminErrorResponse,
  auditFeatureChange,
} from "@/lib/admin-feature-guard";

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  flagState: z.enum(["PER_PLAN", "FORCE_ON", "KILL_SWITCH"]).optional(),
});

/**
 * PATCH /api/admin/features/[id] — edit feature metadata and/or its global
 * flag. The slug is never editable here (code-owned).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, buildingId } = await requireSuperAdmin();
    const { id } = await params;
    const body = BodySchema.parse(await request.json());

    const feature = await prisma.feature.findUnique({
      where: { id },
      include: { flag: true },
    });
    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    const metaChanges: Record<string, unknown> = {};
    if (body.name !== undefined) metaChanges.name = body.name;
    if (body.description !== undefined) metaChanges.description = body.description;
    if (body.isActive !== undefined) metaChanges.isActive = body.isActive;

    if (Object.keys(metaChanges).length > 0) {
      await prisma.feature.update({ where: { id }, data: metaChanges });
      await auditFeatureChange({
        userId,
        buildingId,
        action: "feature.update",
        entityType: "Feature",
        entityId: id,
        oldValue: {
          name: feature.name,
          description: feature.description,
          isActive: feature.isActive,
        },
        newValue: metaChanges,
      });
    }

    if (body.flagState !== undefined) {
      await prisma.featureFlag.upsert({
        where: { featureId: id },
        update: { state: body.flagState, updatedById: userId },
        create: { featureId: id, state: body.flagState, updatedById: userId },
      });
      await auditFeatureChange({
        userId,
        buildingId,
        action: "feature.flag.update",
        entityType: "Feature",
        entityId: id,
        oldValue: { flagState: feature.flag?.state ?? "PER_PLAN" },
        newValue: { flagState: body.flagState },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: error.issues }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
