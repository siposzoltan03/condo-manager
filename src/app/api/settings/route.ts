import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { hashPassword, validatePassword } from "@/lib/password";
import {
  getUserSettings,
  getUserUnitInBuilding,
  getUserPasswordHash,
  updateUserSettings,
} from "@/lib/profile-dal";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserSettings(sessionUser.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const activeRole = sessionUser.activeRole ?? "OWNER";
    const unit = sessionUser.activeBuildingId
      ? await getUserUnitInBuilding(sessionUser.id, sessionUser.activeBuildingId)
      : null;

    return NextResponse.json({ ...user, role: activeRole, unit });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
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

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 },
        );
      }
      updateData.name = name.trim();
    }

    if (language !== undefined) {
      if (language !== "hu" && language !== "en") {
        return NextResponse.json(
          { error: "Invalid language. Must be 'hu' or 'en'" },
          { status: 400 },
        );
      }
      updateData.language = language;
    }

    if (notificationPreferences !== undefined) {
      if (
        typeof notificationPreferences !== "object" ||
        notificationPreferences === null ||
        Array.isArray(notificationPreferences)
      ) {
        return NextResponse.json(
          { error: "Invalid notification preferences format" },
          { status: 400 },
        );
      }
      updateData.notificationPreferences = notificationPreferences;
    }

    if (newPassword !== undefined) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change password" },
          { status: 400 },
        );
      }
      if (typeof newPassword !== "string") {
        return NextResponse.json(
          { error: "Invalid password format" },
          { status: 400 },
        );
      }
      const passwordCheck = validatePassword(newPassword);
      if (!passwordCheck.valid) {
        return NextResponse.json(
          { error: passwordCheck.errors.join(". ") },
          { status: 400 },
        );
      }

      const dbUser = await getUserPasswordHash(sessionUser.id);
      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 403 },
        );
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const updatedUser = await updateUserSettings(sessionUser.id, updateData);

    return NextResponse.json({
      ...updatedUser,
      role: sessionUser.activeRole ?? "OWNER",
    });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
