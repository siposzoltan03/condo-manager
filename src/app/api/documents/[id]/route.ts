import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    const { id } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, buildingId: true } },
        uploadedBy: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!document || document.category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Visibility check
    if (document.visibility === "ADMIN_ONLY" && !hasMinimumRole(role, "ADMIN")) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (document.visibility === "BOARD_ONLY" && !hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "BOARD_MEMBER");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.document.findUnique({
      where: { id },
      include: { category: { select: { buildingId: true } } },
    });
    if (!existing || existing.category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { title, description, categoryId, visibility, tags } = body;

    if (visibility && !["PUBLIC", "BOARD_ONLY", "ADMIN_ONLY"].includes(visibility)) {
      return NextResponse.json(
        { error: "Invalid visibility value" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (tags !== undefined) updateData.tags = tags;

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedBy: { select: { id: true, name: true } },
            uploadedAt: true,
          },
        },
      },
    });

    await createAuditLog({
      entityType: "Document",
      entityId: id,
      action: "UPDATE",
      userId,
      oldValue: {
        title: existing.title,
        description: existing.description,
        visibility: existing.visibility,
        categoryId: existing.categoryId,
      },
      newValue: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId, buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const existing = await prisma.document.findUnique({
      where: { id },
      include: { category: { select: { buildingId: true } } },
    });
    if (!existing || existing.category.buildingId !== buildingId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Versions cascade-delete via onDelete: Cascade
    await prisma.document.delete({ where: { id } });

    await createAuditLog({
      entityType: "Document",
      entityId: id,
      action: "DELETE",
      userId,
      oldValue: {
        title: existing.title,
        visibility: existing.visibility,
        categoryId: existing.categoryId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
