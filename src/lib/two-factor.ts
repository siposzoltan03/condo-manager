import "server-only";
import crypto from "crypto";
import {
  generateSecret,
  generateURI,
  verifySync,
} from "otplib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

const ISSUER = "Közös";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5; // → 10 hex chars per code

// otplib v13 functional API — defaults to HMAC-SHA1, 30-second period, 6 digits.
const TOTP_OPTIONS = {
  algorithm: "sha1" as const,
  digits: 6 as const,
  period: 30,
  // epochTolerance in seconds: 30 = ±1 period (current ±1 step), accommodates
  // small clock drift on the user's device.
  epochTolerance: 30,
};

/** Generate a fresh base32 TOTP secret. */
export function generateTotpSecret(): string {
  return generateSecret({ length: 20 });
}

/** Build the otpauth:// provisioning URI for QR scanning. */
export function buildProvisioningUri(email: string, secret: string): string {
  return generateURI({
    strategy: "totp",
    label: email,
    issuer: ISSUER,
    secret,
    algorithm: TOTP_OPTIONS.algorithm,
    digits: TOTP_OPTIONS.digits,
    period: TOTP_OPTIONS.period,
  });
}

/** Render a Data URL PNG QR for the otpauth URI. */
export async function buildQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
}

/** Verify a 6-digit TOTP code against a secret. */
export function verifyTotp(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code.trim())) return false;
  try {
    const result = verifySync({
      token: code.trim(),
      secret,
      algorithm: TOTP_OPTIONS.algorithm,
      digits: TOTP_OPTIONS.digits,
      period: TOTP_OPTIONS.period,
      epochTolerance: TOTP_OPTIONS.epochTolerance,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Format a 10-hex-char backup code as XXXXX-XXXXX for display. */
function formatBackupCode(raw: string): string {
  return `${raw.slice(0, 5)}-${raw.slice(5)}`.toUpperCase();
}

/** Generate fresh backup codes (display) + their hashes (storage). */
export function generateBackupCodes(): {
  display: string[];
  hashes: string[];
} {
  const display: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = crypto.randomBytes(BACKUP_CODE_BYTES).toString("hex");
    const formatted = formatBackupCode(raw);
    display.push(formatted);
    hashes.push(hashBackupCode(formatted));
  }
  return { display, hashes };
}

/**
 * Try to redeem a backup code: looks up an unused code matching the hash and
 * marks it consumed. Returns true if a code was redeemed.
 */
export async function consumeBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  const hash = hashBackupCode(normalized);
  const row = await prisma.backupCode.findUnique({ where: { codeHash: hash } });
  if (!row || row.userId !== userId || row.usedAt) return false;
  await prisma.backupCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return true;
}

/**
 * Verify either a TOTP code OR a backup code. Used at sign-in. The order
 * matters: TOTP first (more common), backup as fallback.
 */
export async function verifyTwoFactor(
  userId: string,
  totpSecret: string,
  code: string,
): Promise<boolean> {
  if (verifyTotp(code, totpSecret)) return true;
  return consumeBackupCode(userId, code);
}
