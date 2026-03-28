import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireBuildingContext();
    const { id } = await params;

    const building = await prisma.building.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            units: true,
            userBuildings: true,
          },
        },
      },
    });

    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: building.id,
      name: building.name,
      address: building.address,
      city: building.city,
      zipCode: building.zipCode,
      unitCount: building._count.units,
      userCount: building._count.userBuildings,
      createdAt: building.createdAt,
      updatedAt: building.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch building:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { role: activeRole } = await requireBuildingContext();

    try {
      await requireRole(activeRole, "SUPER_ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, address, city, zipCode } = body;

    const existing = await prisma.building.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (zipCode !== undefined) updateData.zipCode = zipCode;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const building = await prisma.building.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            units: true,
            userBuildings: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: building.id,
      name: building.name,
      address: building.address,
      city: building.city,
      zipCode: building.zipCode,
      unitCount: building._count.units,
      userCount: building._count.userBuildings,
    });
  } catch (error) {
    console.error("Failed to update building:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { role: activeRole } = await requireBuildingContext();

    try {
      await requireRole(activeRole, "SUPER_ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const building = await prisma.building.findUnique({
      where: { id },
      include: { _count: { select: { units: true } } },
    });

    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }

    if (building._count.units > 0) {
      return NextResponse.json(
        { error: "Cannot delete building with existing units. Remove all units first." },
        { status: 409 }
      );
    }

    // Delete UserBuilding records first, then the building
    await prisma.userBuilding.deleteMany({ where: { buildingId: id } });
    await prisma.building.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete building:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
