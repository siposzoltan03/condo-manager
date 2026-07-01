import NextAuth from "next-auth";
import { authOptions } from "./auth-options";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user;
}

export async function requireBuildingContext() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // SUPER_ADMIN read-only impersonation: when active, evaluate authorization AND
  // data as the impersonated member (their userId, role, flags) so reads return
  // exactly what that user sees — while keeping the real superadmin id as
  // `realUserId` for audit. Writes are blocked globally by middleware.
  const imp = user.impersonating;
  const buildingId = imp?.buildingId ?? user.activeBuildingId;
  if (!buildingId) throw new Error("No building selected");

  const userId = imp?.userId ?? user.id;
  const role = imp?.role ?? user.activeRole;

  // Board-permission grants are additive delegation (per-resident editor).
  // Load fresh (not from the session) so an admin's toggle applies immediately,
  // and only for BOARD_MEMBER — ADMIN/SUPER_ADMIN already hold these caps and
  // OWNER/TENANT are never granted board permissions.
  let grants: string[] = [];
  if (role === "BOARD_MEMBER") {
    const rows = await prisma.userBuildingPermission.findMany({
      where: { userBuilding: { userId, buildingId } },
      select: { permission: { select: { key: true } } },
    });
    grants = rows.map((r) => r.permission.key);
  }

  return {
    userId,
    buildingId,
    role,
    grants,
    // ActorContext flags — already hydrated into the session (auth-options.ts).
    // Enables can(actor, capability) at call-sites without extra DB lookups.
    isChair: (imp ? imp.isChair : user.isChair) ?? false,
    isProfessional: (imp ? false : user.isProfessional) ?? false,
    ownsAnyUnit: (imp ? imp.ownsAnyUnit : user.ownsAnyUnit) ?? false,
    isAuditor: (imp ? imp.isAuditor : user.isAuditor) ?? false,
    /** True when the active context is an impersonation (read-only). */
    impersonating: !!imp,
    /** The real superadmin id — equals userId unless impersonating. For audit. */
    realUserId: user.id,
  };
}
