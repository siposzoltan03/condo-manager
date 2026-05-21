import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless email-verification token for contractor signup.
 *
 * Avoids needing a separate DB table for one-shot tokens. Single-use is
 * enforced by `ContractorUser.emailVerifiedAt` — once set, the same
 * token simply has no effect on re-use.
 *
 * Format: `<base64url-payload>.<hex-hmac>`
 *   payload = JSON({ uid, exp })  where exp is a unix-ms timestamp
 *   hmac    = HMAC-SHA-256 over the base64url payload, keyed by
 *             `NEXTAUTH_SECRET` (with a fallback for dev)
 */

const SECRET =
  process.env.NEXTAUTH_SECRET ?? "dev-only-contractor-verify-key";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signVerificationToken(userId: string, ttlHours = 24): string {
  const payload = JSON.stringify({
    uid: userId,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  });
  const encoded = b64url(Buffer.from(payload, "utf8"));
  const hmac = createHmac("sha256", SECRET).update(encoded).digest("hex");
  return `${encoded}.${hmac}`;
}

export interface VerifyResult {
  ok: true;
  userId: string;
}
export interface VerifyError {
  ok: false;
  reason: "MALFORMED" | "SIGNATURE" | "EXPIRED";
}

export function verifyVerificationToken(token: string): VerifyResult | VerifyError {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED" };
  const [encoded, sig] = parts;

  const expected = createHmac("sha256", SECRET).update(encoded).digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { ok: false, reason: "SIGNATURE" };
  }

  let payload: { uid?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(fromB64url(encoded).toString("utf8"));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (typeof payload.uid !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "MALFORMED" };
  }
  if (Date.now() > payload.exp) {
    return { ok: false, reason: "EXPIRED" };
  }
  return { ok: true, userId: payload.uid };
}
