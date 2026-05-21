import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueVerificationToken } from "@/lib/email-verification";
import { sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/email-templates";
import { escapeHtml } from "@/lib/escape-html";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Resend the verification email to a user who hasn't verified yet.
 * Always returns 200 to prevent email enumeration — the response gives no
 * signal about whether the email exists in the system.
 */
export async function POST(request: NextRequest) {
  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email?.toLowerCase().trim();
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!email) return NextResponse.json({ ok: true });

  // Rate limit: 1 resend per minute per email + 10 per hour per IP.
  const emailRl = await rateLimit({
    key: `auth:verify-resend:${email}`,
    limit: 1,
    windowSeconds: 60,
  });
  if (!emailRl.success) return NextResponse.json({ ok: true });

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipRl = await rateLimit({
    key: `auth:verify-resend:ip:${ip}`,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!ipRl.success) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, emailVerifiedAt: true, language: true },
  });

  if (!user || user.emailVerifiedAt) {
    // Already verified or doesn't exist — silently succeed.
    return NextResponse.json({ ok: true });
  }

  const rawToken = await issueVerificationToken(user.id);
  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? "http://localhost:3000";
  const locale = user.language === "en" ? "en" : "hu";
  const verificationLink = `${baseUrl}/${locale}/verify-email/${rawToken}`;

  const { subject, html } = verificationEmail({
    recipientName: escapeHtml(user.name),
    verificationLink,
    expiryHours: 24,
    locale,
  });
  try {
    await sendEmail(user.email, subject, html);
  } catch (err) {
    console.error("[resend-verification] email send failed:", err);
  }

  return NextResponse.json({ ok: true });
}
