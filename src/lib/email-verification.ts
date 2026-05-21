import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Email-verification token generator + consumer.
 *
 * Pattern (matches password-reset): generate a 32-byte raw token, store its
 * SHA-256 hash, send the raw value via email. On verification we hash the
 * incoming raw value and look it up.
 */

export const VERIFICATION_TOKEN_TTL_HOURS = 24;

export function generateVerificationToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashVerificationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Atomically consume a verification token and mark the User as verified.
 * Returns null on any failure (token not found, expired, already consumed).
 */
export async function consumeVerificationToken(
  rawToken: string,
): Promise<{ userId: string; email: string } | null> {
  const tokenHash = hashVerificationToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const row = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } },
    });
    if (!row) return null;
    if (row.consumedAt) return null;
    if (row.expiresAt < new Date()) return null;

    // Idempotent: if already verified, still consume but treat as success.
    await tx.emailVerificationToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    if (!row.user.emailVerifiedAt) {
      await tx.user.update({
        where: { id: row.user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return { userId: row.user.id, email: row.user.email };
  });
}

/**
 * Issue a new verification token for the user. Voids any unused prior
 * tokens for this user (defensive — prevents two valid tokens floating
 * around if the user requested a resend).
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  const { raw, hash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hash, expiresAt },
    }),
  ]);

  return raw;
}
