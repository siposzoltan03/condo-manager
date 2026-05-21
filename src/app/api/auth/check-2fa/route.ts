import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/check-2fa
 *
 * Pre-check used by the login form. Validates email + password and reports
 * whether the account has 2FA enrolled, so the form can switch to the TOTP
 * step before calling NextAuth signIn.
 *
 * Returns intentionally generic responses to avoid leaking which accounts
 * exist or have 2FA enabled. Rate-limited per email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, twoFactorRequired: false },
        { status: 200 },
      );
    }

    const rl = await rateLimit({
      key: `auth:check2fa:${email.toLowerCase()}`,
      limit: 10,
      windowSeconds: 15 * 60,
    });
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, twoFactorRequired: false },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
        emailVerifiedAt: true,
        totpEnrolledAt: true,
      },
    });

    // Always run bcrypt to keep timing roughly constant.
    const dummy =
      "$2a$12$000000000000000000000uGIvBnzJPiFABWFCIAHBBfZfQBdAQX2u";
    const passwordOk = await bcrypt.compare(
      password,
      user?.passwordHash ?? dummy,
    );

    if (!user || !user.isActive || !user.emailVerifiedAt || !passwordOk) {
      return NextResponse.json(
        { ok: false, twoFactorRequired: false },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      twoFactorRequired: !!user.totpEnrolledAt,
    });
  } catch (error) {
    console.error("Failed to check 2FA status:", error);
    return NextResponse.json(
      { ok: false, twoFactorRequired: false },
      { status: 500 },
    );
  }
}
