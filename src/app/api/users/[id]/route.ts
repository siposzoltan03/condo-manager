import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  unitId: true,
  isPrimaryContact: true,
  language: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  unit: {
    select: {
      number: true,
    },
  },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireRole(currentUser.role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        unitId: true,
        isPrimaryContact: true,
        isActive: true,
      },
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
      isElevatedRole(existingUser.role)
    ) {
      if (!hasMinimumRole(currentUser.role, "SUPER_ADMIN")) {
        return NextResponse.json(
          {
            error:
              "Only SUPER_ADMIN can change to or from ADMIN/SUPER_ADMIN roles",
          },
          { status: 403 }
        );
      }
    }

    // Verify unit exists if changing it
    if (unitId !== undefined) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }
    }

    // If setting isPrimaryContact, unset existing primary on the target unit
    const targetUnitId = unitId ?? existingUser.unitId;
    if (isPrimaryContact === true) {
      await prisma.user.updateMany({
        where: {
          unitId: targetUnitId,
          isPrimaryContact: true,
          id: { not: id },
        },
        data: { isPrimaryContact: false },
      });
    }

    // Build update data — only include fields that were provided
    const updateData: Prisma.UserUpdateInput = {};
    if (role !== undefined) updateData.role = role;
    if (unitId !== undefined) updateData.unit = { connect: { id: unitId } };
    if (isPrimaryContact !== undefined)
      updateData.isPrimaryContact = isPrimaryContact;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    // Build old/new value diff for audit log
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (role !== undefined) {
      oldValue.role = existingUser.role;
      newValue.role = role;
    }
    if (unitId !== undefined) {
      oldValue.unitId = existingUser.unitId;
      newValue.unitId = unitId;
    }
    if (isPrimaryContact !== undefined) {
      oldValue.isPrimaryContact = existingUser.isPrimaryContact;
      newValue.isPrimaryContact = isPrimaryContact;
    }
    if (isActive !== undefined) {
      oldValue.isActive = existingUser.isActive;
      newValue.isActive = isActive;
    }

    await createAuditLog({
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      userId: currentUser.id,
      oldValue,
      newValue,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
