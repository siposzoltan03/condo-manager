import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { buildingId, role } = await requireBuildingContext();

    try {
      await requireRole(role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const units = await prisma.unit.findMany({
      where: { buildingId },
      select: {
        id: true,
        number: true,
        floor: true,
      },
      orderBy: { number: "asc" },
    });

    return NextResponse.json(units);
  } catch (error) {
    console.error("Failed to fetch units:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
