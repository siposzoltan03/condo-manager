import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Generate a fresh opaque session token-id. */
export function generateSessionTokenId(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Truncate an IP to a /24 (v4) or /48 (v6) for privacy. */
export function maskIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = raw.trim().split(",")[0]?.trim();
  if (!ip) return null;
  // IPv6 (contains :) — keep first 3 hextets.
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::";
  }
  // IPv4 — keep first 3 octets.
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
}

/**
 * Best-effort User-Agent → "Device · Browser · OS" label. Built without an
 * external lib; the parsing is intentionally simple and falls back gracefully.
 */
export function deviceLabelFromUA(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const ualc = ua.toLowerCase();

  let device = "Web";
  if (ualc.includes("iphone")) device = "iPhone";
  else if (ualc.includes("ipad")) device = "iPad";
  else if (ualc.includes("android")) device = "Android";
  else if (ualc.includes("macintosh") || ualc.includes("mac os x")) device = "Mac";
  else if (ualc.includes("windows")) device = "Windows";
  else if (ualc.includes("linux")) device = "Linux";

  let browser = "Browser";
  let version = "";
  // Order matters — Edge/Brave include "Chrome" so check them first.
  const matchers: [RegExp, string][] = [
    [/edg\/(\d+)/i, "Edge"],
    [/firefox\/(\d+)/i, "Firefox"],
    [/chrome\/(\d+)/i, "Chrome"],
    [/safari\/(\d+)/i, "Safari"],
  ];
  for (const [re, name] of matchers) {
    const m = ua.match(re);
    if (m) {
      browser = name;
      version = m[1];
      break;
    }
  }

  let os = "";
  if (ualc.includes("mac os x")) os = "macOS";
  else if (ualc.includes("windows nt 10")) os = "Windows 10/11";
  else if (ualc.includes("android")) os = "Android";
  else if (ualc.includes("iphone os") || ualc.includes("os ")) os = "iOS";

  const browserLabel = version ? `${browser} ${version}` : browser;
  return os ? `${device} · ${browserLabel} · ${os}` : `${device} · ${browserLabel}`;
}

/** Read the request IP from x-forwarded-for. Returns null if header missing. */
export function readForwardedIp(
  headers: Headers | { get(name: string): string | null },
): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/**
 * Create a UserSession row at sign-in. The `tokenId` is what we'll store
 * in the JWT so subsequent requests can correlate to this row.
 */
export async function recordSession(opts: {
  userId: string;
  tokenId: string;
  userAgent: string | null;
  ip: string | null;
}): Promise<void> {
  const ua = opts.userAgent?.slice(0, 512) ?? null;
  await prisma.userSession.create({
    data: {
      userId: opts.userId,
      tokenId: opts.tokenId,
      userAgent: ua,
      ipMasked: maskIp(opts.ip),
      deviceLabel: deviceLabelFromUA(ua),
    },
  });
}

/**
 * Touch the lastActiveAt timestamp on the session matching tokenId. Returns
 * true if the session is still active, false if revoked or missing.
 */
export async function touchSession(tokenId: string): Promise<boolean> {
  const row = await prisma.userSession.findUnique({
    where: { tokenId },
    select: { id: true, revokedAt: true },
  });
  if (!row) return false;
  if (row.revokedAt) return false;
  // Don't touch on every single request; rate-limit the write to ~5 minutes.
  await prisma.userSession.update({
    where: { id: row.id },
    data: { lastActiveAt: new Date() },
  });
  return true;
}

/** Revoke a session. Returns true if it was active and got revoked. */
export async function revokeSession(
  sessionId: string,
  ownerUserId: string,
): Promise<boolean> {
  const row = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, revokedAt: true },
  });
  if (!row || row.userId !== ownerUserId || row.revokedAt) return false;
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  return true;
}

/** Revoke a session by tokenId (used on signOut event). */
export async function revokeByTokenId(tokenId: string): Promise<void> {
  try {
    await prisma.userSession.update({
      where: { tokenId },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Row may already be revoked / missing — silent.
  }
}
