import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";
import type { Invitation, Building } from "@prisma/client";

/**
 * Generates a cryptographically secure invitation token.
 * Returns both the raw token (sent to the user) and the SHA-256 hash (stored in DB).
 */
export function generateInvitationToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/**
 * Hashes a raw token using SHA-256. Used to look up invitations by token.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Finds an invitation by its raw token. Hashes the token and queries by tokenHash.
 * Includes the building and subscription relations for context.
 */
export async function findInvitationByToken(token: string) {
  const tokenHash = hashToken(token);
  return prisma.invitation.findUnique({
    where: { tokenHash },
    include: {
      building: true,
      subscription: true,
      unit: true,
    },
  });
}

/**
 * Checks whether an invitation is expired or no longer in PENDING status.
 */
export function isInvitationExpired(invitation: Pick<Invitation, "expiresAt" | "status">): boolean {
  if (invitation.status !== "PENDING") return true;
  return new Date() > invitation.expiresAt;
}

/**
 * Calculates the invitation expiry date based on the building's configured
 * expiry hours, or a default of 168 hours (7 days).
 */
export function getInvitationExpiryDate(
  building: Pick<Building, "invitationExpiryHours"> | null,
  defaultHours = 168
): Date {
  const hours = building?.invitationExpiryHours ?? defaultHours;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
