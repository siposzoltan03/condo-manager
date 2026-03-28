import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { DocumentVisibility } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine which visibilities user can see
    const isAdmin = hasMinimumRole(user.role, "ADMIN");
    const isBoardPlus = hasMinimumRole(user.role, "BOARD_MEMBER");

    let allowedVisibilities: DocumentVisibility[];
    if (isAdmin) {
      allowedVisibilities = ["PUBLIC", "BOARD_ONLY", "ADMIN_ONLY"];
    } else if (isBoardPlus) {
      allowedVisibilities = ["PUBLIC", "BOARD_ONLY"];
    } else {
      allowedVisibilities = ["PUBLIC"];
    }

    const categories = await prisma.documentCategory.findMany({
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireRole(user.role, "ADMIN");
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
      },
    });

    await createAuditLog({
      entityType: "DocumentCategory",
      entityId: category.id,
      action: "CREATE",
      userId: user.id,
      newValue: { name, icon, parentId },
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
