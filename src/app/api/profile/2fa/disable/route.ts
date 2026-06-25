import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireBuildingContext } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { verifyTwoFactor } from "@/lib/two-factor";

/**
 * POST /api/profile/2fa/disable
 *
 * Disabling 2FA requires both the current password AND a valid TOTP / backup
 * code to defend against session-token theft.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireBuildingContext();
    const body = await request.json();
    const password = String(body?.password ?? "");
    const code = String(body?.code ?? "").trim();

    if (!password || !code) {
      return NextResponse.json(
        { error: "Password and code are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        totpSecret: true,
        totpEnrolledAt: true,
      },
    });
    if (!user || !user.totpSecret || !user.totpEnrolledAt) {
      return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid password" }, { status: 400 });
    }

    const codeOk = await verifyTwoFactor(userId, user.totpSecret, code);
    if (!codeOk) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnrolledAt: null },
      }),
      prisma.backupCode.deleteMany({ where: { userId } }),
    ]);

    await createAuditLog({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      userId,
      newValue: { twoFactorEnabled: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disable 2FA:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
