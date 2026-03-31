import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        language: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get the user's role and unit from building context
    const activeRole = sessionUser.activeRole ?? "RESIDENT";

    // Get unit info from UnitUser for the active building
    let unitInfo: { number: string } | null = null;
    if (sessionUser.activeBuildingId) {
      const unitUser = await prisma.unitUser.findFirst({
        where: { userId: sessionUser.id, unit: { buildingId: sessionUser.activeBuildingId } },
        include: { unit: { select: { number: true } } },
      });
      unitInfo = unitUser ? { number: unitUser.unit.number } : null;
    }

    return NextResponse.json({
      ...user,
      role: activeRole,
      unit: unitInfo,
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, language, notificationPreferences, currentPassword, newPassword } = body;

    const updateData: Prisma.UserUpdateInput = {};

    // Update name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    // Update language if provided
    if (language !== undefined) {
      if (language !== "hu" && language !== "en") {
        return NextResponse.json(
          { error: "Invalid language. Must be 'hu' or 'en'" },
          { status: 400 }
        );
      }
      updateData.language = language;
    }

    // Update notification preferences if provided
    if (notificationPreferences !== undefined) {
      if (
        typeof notificationPreferences !== "object" ||
        notificationPreferences === null ||
        Array.isArray(notificationPreferences)
      ) {
        return NextResponse.json(
          { error: "Invalid notification preferences format" },
          { status: 400 }
        );
      }
      updateData.notificationPreferences = notificationPreferences;
    }

    // Change password if requested
    if (newPassword !== undefined) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change password" },
          { status: 400 }
        );
      }

      if (typeof newPassword !== "string") {
        return NextResponse.json(
          { error: "Invalid password format" },
          { status: 400 }
        );
      }

      const passwordCheck = validatePassword(newPassword);
      if (!passwordCheck.valid) {
        return NextResponse.json(
          { error: passwordCheck.errors.join(". ") },
          { status: 400 }
        );
      }

      // Verify current password
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { passwordHash: true },
      });

      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 403 }
        );
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        language: true,
        notificationPreferences: true,
      },
    });

    return NextResponse.json({
      ...updatedUser,
      role: sessionUser.activeRole ?? "RESIDENT",
    });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
