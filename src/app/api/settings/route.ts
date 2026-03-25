import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
        role: true,
        language: true,
        notificationPreferences: true,
        unit: {
          select: {
            number: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
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

    const updateData: Record<string, unknown> = {};

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
      if (typeof notificationPreferences !== "object") {
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

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
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
        role: true,
        language: true,
        notificationPreferences: true,
        unit: {
          select: {
            number: true,
          },
        },
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
