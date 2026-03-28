import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma, BuildingRole, UnitRelationship } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { userId, buildingId, role: activeRole } = await requireBuildingContext();

    try {
      await requireRole(activeRole, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const roleFilter = searchParams.get("role") ?? undefined;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = 20;
    const skip = (page - 1) * limit;

    // List users who belong to this building via UserBuilding
    const where: Prisma.UserBuildingWhereInput = { buildingId };

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (roleFilter) {
      if (!Object.values(BuildingRole).includes(roleFilter as BuildingRole)) {
        return NextResponse.json(
          { error: "Invalid role filter" },
          { status: 400 }
        );
      }
      where.role = roleFilter as BuildingRole;
    }

    const [userBuildings, total] = await Promise.all([
      prisma.userBuilding.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              language: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
        skip,
        take: limit,
      }),
      prisma.userBuilding.count({ where }),
    ]);

    // Fetch unit assignments for these users in this building
    const userIds = userBuildings.map((ub) => ub.userId);
    const unitUsers = await prisma.unitUser.findMany({
      where: { userId: { in: userIds }, unit: { buildingId } },
      include: { unit: { select: { id: true, number: true } } },
    });
    const unitMap = new Map<string, { unitId: string; unitNumber: string; isPrimaryContact: boolean; relationship: string }>();
    for (const uu of unitUsers) {
      if (!unitMap.has(uu.userId)) {
        unitMap.set(uu.userId, {
          unitId: uu.unit.id,
          unitNumber: uu.unit.number,
          isPrimaryContact: uu.isPrimaryContact,
          relationship: uu.relationship,
        });
      }
    }

    const users = userBuildings.map((ub) => ({
      id: ub.user.id,
      email: ub.user.email,
      name: ub.user.name,
      role: ub.role,
      unitId: unitMap.get(ub.userId)?.unitId ?? null,
      unit: unitMap.get(ub.userId) ? { number: unitMap.get(ub.userId)!.unitNumber } : null,
      isPrimaryContact: unitMap.get(ub.userId)?.isPrimaryContact ?? false,
      relationship: unitMap.get(ub.userId)?.relationship ?? null,
      language: ub.user.language,
      isActive: ub.user.isActive,
      createdAt: ub.user.createdAt,
      updatedAt: ub.user.updatedAt,
    }));

    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId: currentUserId, buildingId, role: activeRole } = await requireBuildingContext();

    try {
      await requireRole(activeRole, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role, unitId, isPrimaryContact, temporaryPassword, relationship } =
      body;

    if (!email || !name || !role || !unitId || !temporaryPassword) {
      return NextResponse.json(
        { error: "Missing required fields: email, name, role, unitId, temporaryPassword" },
        { status: 400 }
      );
    }

    if (!Object.values(BuildingRole).includes(role as BuildingRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN or ADMIN roles
    if (
      (role === "SUPER_ADMIN" || role === "ADMIN") &&
      !hasMinimumRole(activeRole, "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN roles" },
        { status: 403 }
      );
    }

    // Verify unit exists and belongs to this building
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit || unit.buildingId !== buildingId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    // Check if user with this email already exists
    let existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // Check if user is already in this building
      const existingMembership = await prisma.userBuilding.findFirst({
        where: { userId: existingUser.id, buildingId },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this building" },
          { status: 409 }
        );
      }
    }

    // If isPrimaryContact, unset existing primary on that unit via UnitUser
    if (isPrimaryContact) {
      await prisma.unitUser.updateMany({
        where: { unitId, isPrimaryContact: true },
        data: { isPrimaryContact: false },
      });
    }

    // Use a transaction: create User (if new) + UserBuilding + UnitUser
    const result = await prisma.$transaction(async (tx) => {
      let targetUser = existingUser;
      if (!targetUser) {
        targetUser = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
          },
        });
      }

      // Create UserBuilding membership
      await tx.userBuilding.create({
        data: {
          userId: targetUser.id,
          buildingId,
          role: role as BuildingRole,
        },
      });

      // Create UnitUser link
      const unitRelationship = relationship && Object.values(UnitRelationship).includes(relationship as UnitRelationship)
        ? (relationship as UnitRelationship)
        : UnitRelationship.OWNER;
      await tx.unitUser.create({
        data: {
          userId: targetUser.id,
          unitId,
          relationship: unitRelationship,
          isPrimaryContact: isPrimaryContact ?? false,
        },
      });

      return targetUser;
    });

    await createAuditLog({
      entityType: "User",
      entityId: result.id,
      action: "CREATE",
      userId: currentUserId,
      newValue: { email, name, role, unitId, buildingId, isPrimaryContact: isPrimaryContact ?? false },
    });

    return NextResponse.json({
      id: result.id,
      email: result.email,
      name: result.name,
      role,
      unitId,
      unit: { number: unit.number },
      isPrimaryContact: isPrimaryContact ?? false,
      isActive: result.isActive,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
