import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword, validatePassword } from "@/lib/password";

export const runtime = "nodejs";

/**
 * POST /api/auth/change-password
 * In-app password change for a signed-in user.
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 attempts / 15 min per user.
    const rl = await rateLimit({ key: `auth:change-password:${user.id}`, limit: 5, windowSeconds: 15 * 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const { currentPassword, newPassword } = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const strength = validatePassword(newPassword);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.errors.join(". ") }, { status: 400 });
    }

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    // No local password (e.g. SSO-only account) — can't change here.
    if (!row?.passwordHash) {
      return NextResponse.json({ error: "NO_PASSWORD" }, { status: 400 });
    }

    const ok = await verifyPassword(currentPassword, row.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "WRONG_CURRENT" }, { status: 400 });
    }
    if (await verifyPassword(newPassword, row.passwordHash)) {
      return NextResponse.json({ error: "SAME_PASSWORD" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to change password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
