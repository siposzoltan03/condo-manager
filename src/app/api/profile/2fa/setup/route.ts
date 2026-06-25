import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateTotpSecret,
  buildProvisioningUri,
  buildQrDataUrl,
  generateBackupCodes,
} from "@/lib/two-factor";

/**
 * POST /api/profile/2fa/setup
 *
 * Begins enrollment: generates a fresh TOTP secret + 10 backup codes, stores
 * them on the user (NOT yet flipping totpEnrolledAt — that happens after
 * successful verification of the first code via /verify), and returns the QR
 * + backup codes for the setup UI.
 */
export async function POST(_request: NextRequest) {
  try {
    const { userId } = await requireBuildingContext();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, totpEnrolledAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.totpEnrolledAt) {
      return NextResponse.json(
        { error: "Already enrolled. Disable first to re-enroll." },
        { status: 409 },
      );
    }

    const secret = generateTotpSecret();
    const otpauth = buildProvisioningUri(user.email, secret);
    const qrDataUrl = await buildQrDataUrl(otpauth);
    const { display, hashes } = generateBackupCodes();

    // Persist the (provisional) secret + hashed backup codes. Until /verify
    // succeeds, totpEnrolledAt remains null and sign-in is NOT gated.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { totpSecret: secret },
      }),
      prisma.backupCode.deleteMany({ where: { userId } }),
      prisma.backupCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);

    return NextResponse.json({
      otpauthUri: otpauth,
      qrDataUrl,
      manualKey: secret,
      backupCodes: display,
    });
  } catch (error) {
    console.error("Failed to start 2FA enrollment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
