import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireRole, hasMinimumRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireRole(user.role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const role = searchParams.get("role") ?? undefined;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      if (!Object.values(Role).includes(role as Role)) {
        return NextResponse.json(
          { error: "Invalid role filter" },
          { status: 400 }
        );
      }
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

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
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireRole(currentUser.role, "ADMIN");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role, unitId, isPrimaryContact, temporaryPassword } =
      body;

    if (!email || !name || !role || !unitId || !temporaryPassword) {
      return NextResponse.json(
        { error: "Missing required fields: email, name, role, unitId, temporaryPassword" },
        { status: 400 }
      );
    }

    if (!Object.values(Role).includes(role as Role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN or ADMIN roles
    if (
      (role === "SUPER_ADMIN" || role === "ADMIN") &&
      !hasMinimumRole(currentUser.role, "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN roles" },
        { status: 403 }
      );
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    // Verify unit exists
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    // If isPrimaryContact, unset existing primary on that unit
    if (isPrimaryContact) {
      await prisma.user.updateMany({
        where: { unitId, isPrimaryContact: true },
        data: { isPrimaryContact: false },
      });
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        role: role as Role,
        unitId,
        isPrimaryContact: isPrimaryContact ?? false,
        passwordHash,
      },
      select: userSelect,
    });

    await createAuditLog({
      entityType: "User",
      entityId: newUser.id,
      action: "CREATE",
      userId: currentUser.id,
      newValue: { email, name, role, unitId, isPrimaryContact: isPrimaryContact ?? false },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
