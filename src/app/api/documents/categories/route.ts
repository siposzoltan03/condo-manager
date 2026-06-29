import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows, requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { DocumentVisibility } from "@prisma/client";
import { documentCategoryCreated } from "@/lib/documents/events";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { buildingId } = ctx;

    // Determine which visibilities user can see
    const isAdmin = allows(ctx, "view.adminContext");
    const isBoardPlus = allows(ctx, "view.boardContext");

    let allowedVisibilities: DocumentVisibility[];
    if (isAdmin) {
      allowedVisibilities = ["PUBLIC", "BOARD_ONLY", "ADMIN_ONLY"];
    } else if (isBoardPlus) {
      allowedVisibilities = ["PUBLIC", "BOARD_ONLY"];
    } else {
      allowedVisibilities = ["PUBLIC"];
    }

    const categories = await prisma.documentCategory.findMany({
      where: { buildingId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            documents: {
              where: {
                visibility: { in: allowedVisibilities },
              },
            },
          },
        },
        children: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: {
              select: {
                documents: {
                  where: {
                    visibility: { in: allowedVisibilities },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Return only top-level categories (parentId null) with children nested
    const topLevel = categories.filter((c) => !c.parentId);

    const result = topLevel.map((cat) => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      documentCount: cat._count.documents,
      children: cat.children.map((child) => ({
        id: child.id,
        name: child.name,
        icon: child.icon,
        sortOrder: child.sortOrder,
        documentCount: child._count.documents,
      })),
    }));

    return NextResponse.json({ categories: result });
  } catch (error) {
    console.error("Failed to fetch document categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;

    try {
      requireCapability(ctx, "view.adminContext");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, icon, parentId, sortOrder } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // If parentId provided, verify it exists
    if (parentId) {
      const parent = await prisma.documentCategory.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 }
        );
      }
    }

    const category = await prisma.documentCategory.create({
      data: {
        name,
        icon: icon ?? null,
        parentId: parentId ?? null,
        sortOrder: sortOrder ?? 0,
        buildingId,
      },
    });

    await documentCategoryCreated({
      categoryId: category.id,
      createdByUserId: userId,
      buildingId,
      name,
      icon,
      parentId,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create document category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
