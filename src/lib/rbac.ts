import { BuildingRole } from "@prisma/client";
import { can, type ActorContext } from "./capabilities";

export { can, type ActorContext } from "./capabilities";
export type { Capability } from "./capabilities";

/**
 * Legacy flat hierarchy. Use `can(actor, capability)` from
 * `./capabilities` for new code. This export is kept for callers that
 * still ask "does this role outrank that role?" — semantically wrong
 * (the law has no linear hierarchy) but useful during the Phase 1 → 3
 * migration. Removed once all call-sites learn to thread the full
 * ActorContext.
 *
 * @deprecated Use `can()` with an `ActorContext`.
 */
export const ROLE_HIERARCHY: Record<BuildingRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  BOARD_MEMBER: 3,
  // Phase 2 — AUDITOR is a *peer* of BOARD_MEMBER in the legal model
  // (Tht. § 27(3) doesn't put auditors in a linear chain). The legacy
  // hierarchy ranks them at BOARD_MEMBER's level so existing callers
  // that use `hasMinimumRole("AUDITOR", "BOARD_MEMBER")` behave like
  // peers. New code should use `can()` keyed off `actor.isAuditor`.
  AUDITOR: 3,
  OWNER: 2,
  TENANT: 1,
};

/** @deprecated Prefer `can()`. */
export function hasMinimumRole(
  userRole: string,
  requiredRole: string,
): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as BuildingRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole as BuildingRole] ?? 99;
  return userLevel >= requiredLevel;
}

// ─── Legacy capability wrappers ───────────────────────────────────────────
//
// These keep call-sites compiling while the implementation flips to the
// `can()` matrix. They take only a role string today; legacy callers
// assumed any BOARD_MEMBER had representative authority, so we preserve
// that by setting `isChair: true` for BOARD_MEMBER in the synthesized
// ActorContext. Once call-sites learn to pass the real flags (Phase 3+),
// switch them to call `can()` directly.

function actorOf(role: string): ActorContext {
  return {
    role: role as BuildingRole,
    isChair: role === "BOARD_MEMBER",
  };
}

export function canManageUsers(role: string): boolean {
  return hasMinimumRole(role, "ADMIN");
}

export function canManageFinances(role: string): boolean {
  return can(actorOf(role), "manage.budget");
}

export function canManageAnnouncements(role: string): boolean {
  return can(actorOf(role), "announcement.publish");
}

export function canManageDocuments(role: string): boolean {
  return can(actorOf(role), "document.publish.public");
}

export async function requireRole(
  userRole: string,
  minimumRole: string,
): Promise<void> {
  if (!hasMinimumRole(userRole, minimumRole)) {
    throw new Error("Forbidden");
  }
}
