import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { buildingId } = await requireBuildingContext();

    try {
      await requireFeature(buildingId, "forum");
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
      }
      throw err;
    }

    const categories = await prisma.forumCategory.findMany({
      where: { buildingId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { topics: true },
        },
      },
    });

    const result = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      topicCount: c._count.topics,
    }));

    return NextResponse.json({ categories: result });
  } catch (error) {
    console.error("Failed to fetch forum categories:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
