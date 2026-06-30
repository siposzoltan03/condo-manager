import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { createDefaultDocumentCategories } from "@/lib/building-setup";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = user.activeRole === "SUPER_ADMIN";

    let buildings;
    if (isSuperAdmin) {
      buildings = await prisma.building.findMany({
        include: {
          _count: {
            select: {
              units: true,
              userBuildings: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    } else {
      const userBuildings = await prisma.userBuilding.findMany({
        where: { userId: user.id },
        include: {
          building: {
            include: {
              _count: {
                select: {
                  units: true,
                  userBuildings: true,
                },
              },
            },
          },
        },
      });
      buildings = userBuildings.map((ub) => ub.building);
    }

    return NextResponse.json({
      buildings: buildings.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
        zipCode: b.zipCode,
        unitCount: b._count.units,
        userCount: b._count.userBuildings,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch buildings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBuildingContext();

    try {
      requireCapability(ctx, "building.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, city, zipCode } = body;

    if (!name || !address || !city || !zipCode) {
      return NextResponse.json(
        { error: "Missing required fields: name, address, city, zipCode" },
        { status: 400 }
      );
    }

    const building = await prisma.building.create({
      data: { name, address, city, zipCode },
    });

    await createDefaultDocumentCategories(prisma, building.id);

    return NextResponse.json(
      {
        id: building.id,
        name: building.name,
        address: building.address,
        city: building.city,
        zipCode: building.zipCode,
        unitCount: 0,
        userCount: 0,
        createdAt: building.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create building:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
