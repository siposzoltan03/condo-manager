import { NextRequest, NextResponse } from "next/server";
import {
  findContractorUserById,
  setContractorUserEmailVerified,
} from "@/lib/contractor";
import { verifyVerificationToken } from "@/lib/contractor/verification";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/contractor/auth/verify-email?token=...
 *
 * Marks `ContractorUser.emailVerifiedAt`. The token is a stateless,
 * HMAC-signed payload — once `emailVerifiedAt` is set, replaying the
 * same link is harmless: we always redirect to `/contractor/login`
 * with a status flag.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit({
    key: `contractor:verify-email:${ip}`,
    limit: 20,
    windowSeconds: 60,
  });

  const base =
    process.env.NEXTAUTH_URL ??
    process.env.BASE_URL ??
    new URL(request.url).origin;

  if (!rl.success) {
    return NextResponse.redirect(
      `${base}/contractor/login?verified=rate-limited`,
    );
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = verifyVerificationToken(token);
  if (!result.ok) {
    return NextResponse.redirect(
      `${base}/contractor/login?verified=${result.reason.toLowerCase()}`,
    );
  }

  const user = await findContractorUserById(result.userId);
  if (!user) {
    return NextResponse.redirect(`${base}/contractor/login?verified=unknown`);
  }

  if (!user.emailVerifiedAt) {
    await setContractorUserEmailVerified(user.id, new Date());
  }

  return NextResponse.redirect(`${base}/contractor/login?verified=ok`);
}
