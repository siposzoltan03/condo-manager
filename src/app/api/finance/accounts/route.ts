import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { buildingId, role } = await requireBuildingContext();

    if (!hasMinimumRole(role, "BOARD_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const accounts = await prisma.account.findMany({
      where: { buildingId },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
