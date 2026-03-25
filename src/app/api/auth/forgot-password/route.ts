import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/escape-html";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "../../../../../worker/processors/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email) {
      // Always return success to prevent email enumeration
      return NextResponse.json({ success: true });
    }

    // Rate limit: 3 requests per email per hour
    const rl = await rateLimit({
      key: `auth:forgot:${email.toLowerCase()}`,
      limit: 3,
      windowSeconds: 60 * 60,
    });
    if (!rl.success) {
      // Still return success to prevent enumeration
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      // Invalidate existing unused tokens for this user (H3)
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Generate token — store hashed, send raw (C3)
      const rawToken = randomBytes(32).toString("hex");
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          token: hashedToken,
          userId: user.id,
          expiresAt,
        },
      });

      // Build reset URL — include locale prefix so the link lands on the
      // correct localised page. Derive locale from the Accept-Language header
      // and fall back to "hu" (the app default).
      const acceptLanguage = request.headers.get("accept-language") ?? "";
      const supportedLocales = ["hu", "en"];
      const preferredLocale = acceptLanguage
        .split(",")
        .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
        .find((lang) => supportedLocales.includes(lang));
      const locale = preferredLocale ?? "hu";
      const baseUrl =
        process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? "http://localhost:3000";
      const resetUrl = `${baseUrl}/${locale}/reset-password?token=${rawToken}`;

      await sendEmail(
        user.email,
        "Password Reset — Condo Manager",
        `
        <h2>Password Reset</h2>
        <p>Hello ${escapeHtml(user.name)},</p>
        <p>You requested a password reset for your Condo Manager account.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background-color:#002045;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
        `
      );
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: true });
  }
}
