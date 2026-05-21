import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/two-factor";

/**
 * POST /api/profile/2fa/verify
 *
 * Confirms enrollment by checking the first TOTP code. Sets totpEnrolledAt
 * on success, which causes future sign-ins to require 2FA.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireBuildingContext();
    const body = await request.json();
    const code = String(body?.code ?? "").trim();
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, totpSecret: true, totpEnrolledAt: true },
    });
    if (!user || !user.totpSecret) {
      return NextResponse.json(
        { error: "Start enrollment first" },
        { status: 400 },
      );
    }
    if (user.totpEnrolledAt) {
      return NextResponse.json({ error: "Already enrolled" }, { status: 409 });
    }

    if (!verifyTotp(code, user.totpSecret)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnrolledAt: new Date() },
    });

    await createAuditLog({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      userId,
      newValue: { twoFactorEnabled: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to verify 2FA:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
