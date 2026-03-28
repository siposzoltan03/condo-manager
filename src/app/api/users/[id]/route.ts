import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Role, BuildingRole } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: currentUserId, buildingId, role: activeRole } = await requireBuildingContext();

    try {
      await requireRole(activeRole, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify user belongs to this building
    const existingMembership = await prisma.userBuilding.findFirst({
      where: { userId: id, buildingId },
    });

    if (!existingMembership) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true, isPrimaryContact: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { role, unitId, isPrimaryContact, isActive } = body;

    // Validate role if provided
    if (role !== undefined && !Object.values(Role).includes(role as Role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Only SUPER_ADMIN can change to/from ADMIN+ roles
    const isElevatedRole = (r: string) =>
      r === "SUPER_ADMIN" || r === "ADMIN";

    if (
      (role !== undefined && isElevatedRole(role)) ||
      isElevatedRole(existingMembership.role)
    ) {
      if (!hasMinimumRole(activeRole, "SUPER_ADMIN")) {
        return NextResponse.json(
          {
            error:
              "Only SUPER_ADMIN can change to or from ADMIN/SUPER_ADMIN roles",
          },
          { status: 403 }
        );
      }
    }

    // Verify unit exists and belongs to this building if changing it
    if (unitId !== undefined) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit || unit.buildingId !== buildingId) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    // Update UserBuilding role
    if (role !== undefined) {
      oldValue.role = existingMembership.role;
      newValue.role = role;
      await prisma.userBuilding.update({
        where: { id: existingMembership.id },
        data: { role: role as BuildingRole },
      });
    }

    // Update isPrimaryContact on User model
    if (isPrimaryContact !== undefined) {
      oldValue.isPrimaryContact = existingUser.isPrimaryContact;
      newValue.isPrimaryContact = isPrimaryContact;
      await prisma.user.update({
        where: { id },
        data: { isPrimaryContact },
      });
    }

    // Update unit assignment if provided
    if (unitId !== undefined) {
      // Remove existing unit links in this building
      const existingUnitUsers = await prisma.unitUser.findMany({
        where: { userId: id, unit: { buildingId } },
        select: { id: true, unitId: true },
      });
      if (existingUnitUsers.length > 0) {
        oldValue.unitId = existingUnitUsers[0].unitId;
        await prisma.unitUser.deleteMany({
          where: { id: { in: existingUnitUsers.map((u) => u.id) } },
        });
      }
      newValue.unitId = unitId;
      await prisma.unitUser.create({
        data: { userId: id, unitId },
      });
    }

    // Update User-level fields
    if (isActive !== undefined) {
      oldValue.isActive = existingUser.isActive;
      newValue.isActive = isActive;
      await prisma.user.update({
        where: { id },
        data: { isActive },
      });
    }

    if (Object.keys(newValue).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await createAuditLog({
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      userId: currentUserId,
      oldValue,
      newValue,
    });

    // Return updated user info
    const updatedMembership = await prisma.userBuilding.findFirst({
      where: { userId: id, buildingId },
    });
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, isPrimaryContact: true, language: true, isActive: true, createdAt: true, updatedAt: true },
    });
    const unitUser = await prisma.unitUser.findFirst({
      where: { userId: id, unit: { buildingId } },
      include: { unit: { select: { id: true, number: true } } },
    });

    return NextResponse.json({
      id: updatedUser!.id,
      email: updatedUser!.email,
      name: updatedUser!.name,
      role: updatedMembership?.role,
      unitId: unitUser?.unit.id ?? null,
      unit: unitUser ? { number: unitUser.unit.number } : null,
      isPrimaryContact: updatedUser!.isPrimaryContact,
      language: updatedUser!.language,
      isActive: updatedUser!.isActive,
      createdAt: updatedUser!.createdAt,
      updatedAt: updatedUser!.updatedAt,
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
