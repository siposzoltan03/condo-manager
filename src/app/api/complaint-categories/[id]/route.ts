import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface PatchBody {
  name?: string;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    if (!allows(ctx, "board.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.complaintCategory.findUnique({
      where: { id },
      select: { id: true, buildingId: true, isDefault: true, isActive: true },
    });
    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as PatchBody;

    // Don't let the user disable the last active category — at least one must
    // remain so the report form has something to pick.
    if (body.isActive === false && existing.isActive) {
      const remaining = await prisma.complaintCategory.count({
        where: { buildingId, isActive: true, id: { not: id } },
      });
      if (remaining === 0) {
        return NextResponse.json(
          { error: "At least one active category is required" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.complaintCategory.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" && body.name.trim()
          ? { name: body.name.trim() }
          : {}),
        ...(body.icon !== undefined ? { icon: body.icon?.trim() || null } : {}),
        ...(typeof body.isActive === "boolean"
          ? { isActive: body.isActive }
          : {}),
        ...(typeof body.sortOrder === "number"
          ? { sortOrder: body.sortOrder }
          : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to patch complaint category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;
    if (!allows(ctx, "board.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.complaintCategory.findUnique({
      where: { id },
      select: {
        id: true,
        buildingId: true,
        isDefault: true,
        _count: { select: { complaints: true } },
      },
    });
    if (!existing || existing.buildingId !== buildingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.isDefault) {
      return NextResponse.json(
        { error: "Default categories cannot be deleted, only hidden" },
        { status: 400 },
      );
    }
    if (existing._count.complaints > 0) {
      return NextResponse.json(
        { error: "Category is in use by existing complaints — hide it instead" },
        { status: 400 },
      );
    }

    await prisma.complaintCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete complaint category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
