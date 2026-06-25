import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { buildingId } = await requireBuildingContext();
    const categories = await prisma.complaintCategory.findMany({
      where: { buildingId },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        sortOrder: true,
        isDefault: true,
        isActive: true,
        _count: { select: { complaints: true } },
      },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to list complaint categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

interface CreateBody {
  name: string;
  icon?: string | null;
}

function slugify(name: string): string {
  // Normalize Hungarian accents and reduce to a-z0-9_- form for stable slugs.
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function POST(request: NextRequest) {
  try {
    const { buildingId, role } = await requireBuildingContext();
    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, icon } = (await request.json()) as CreateBody;
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    const baseSlug = slugify(name) || `cat_${Date.now()}`;
    let slug = baseSlug;
    let attempt = 0;
    while (
      await prisma.complaintCategory.findUnique({
        where: { buildingId_slug: { buildingId, slug } },
        select: { id: true },
      })
    ) {
      attempt++;
      slug = `${baseSlug}_${attempt}`;
      if (attempt > 30) break;
    }

    // Append to the end of the sortOrder list.
    const last = await prisma.complaintCategory.findFirst({
      where: { buildingId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await prisma.complaintCategory.create({
      data: {
        buildingId,
        slug,
        name: name.trim(),
        icon: icon?.trim() || null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        isDefault: false,
        isActive: true,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create complaint category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
