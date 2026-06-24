import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getBuildingOverrideView } from "@/lib/feature-access";
import {
  requireSuperAdmin,
  adminErrorResponse,
  auditFeatureChange,
} from "@/lib/admin-feature-guard";

const PutSchema = z.object({
  featureId: z.string().min(1),
  grant: z.boolean(),
  reason: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
const DeleteSchema = z.object({ featureId: z.string().min(1) });

/** GET — building effective resolution + current overrides. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const view = await getBuildingOverrideView(id);
    if (!view) return NextResponse.json({ error: "Building not found" }, { status: 404 });
    return NextResponse.json(view);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** PUT — set (grant/revoke) a per-building override. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireSuperAdmin();
    const { id: buildingId } = await params;
    const body = PutSchema.parse(await request.json());

    const feature = await prisma.feature.findUnique({ where: { id: body.featureId } });
    if (!feature) return NextResponse.json({ error: "Feature not found" }, { status: 404 });

    await prisma.buildingFeatureOverride.upsert({
      where: { buildingId_featureId: { buildingId, featureId: body.featureId } },
      update: {
        grant: body.grant,
        reason: body.reason ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: userId,
      },
      create: {
        buildingId,
        featureId: body.featureId,
        grant: body.grant,
        reason: body.reason ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: userId,
      },
    });

    await auditFeatureChange({
      userId,
      buildingId,
      action: "building.feature.override",
      entityType: "Building",
      entityId: buildingId,
      newValue: { featureSlug: feature.slug, grant: body.grant, reason: body.reason ?? null, expiresAt: body.expiresAt ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: error.issues }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}

/** DELETE — clear an override (revert to inherit). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireSuperAdmin();
    const { id: buildingId } = await params;
    const { featureId } = DeleteSchema.parse(await request.json());

    await prisma.buildingFeatureOverride.deleteMany({
      where: { buildingId, featureId },
    });

    await auditFeatureChange({
      userId,
      buildingId,
      action: "building.feature.override",
      entityType: "Building",
      entityId: buildingId,
      newValue: { featureId, state: "inherit" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", issues: error.issues }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
