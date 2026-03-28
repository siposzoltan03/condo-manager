import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight user search endpoint for messaging.
 * Returns users who share the active building with the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId } = await requireBuildingContext();

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? "";
    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 50);

    if (!search.trim()) {
      return NextResponse.json({ users: [] });
    }

    // Find users who belong to this building
    const buildingMembers = await prisma.userBuilding.findMany({
      where: {
        buildingId,
        user: {
          isActive: true,
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: limit,
    });

    // Get unit numbers for these users in this building
    const memberUserIds = buildingMembers.map((m) => m.userId);
    const unitUsers = await prisma.unitUser.findMany({
      where: { userId: { in: memberUserIds }, unit: { buildingId } },
      include: { unit: { select: { number: true } } },
    });
    const unitMap = new Map<string, string>();
    for (const uu of unitUsers) {
      if (!unitMap.has(uu.userId)) {
        unitMap.set(uu.userId, uu.unit.number);
      }
    }

    return NextResponse.json({
      users: buildingMembers.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        unitNumber: unitMap.get(m.userId) ?? null,
      })),
    });
  } catch (error) {
    console.error("Failed to search users for messaging:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
