import NextAuth from "next-auth";
import { authOptions } from "./auth-options";

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
  if (!user.activeBuildingId) throw new Error("No building selected");
  return {
    userId: user.id,
    buildingId: user.activeBuildingId,
    role: user.activeRole,
    // ActorContext flags for the ACTIVE building — already hydrated into the
    // session (auth-options.ts) and re-hydrated on building switch. Enables
    // can(actor, capability) at call-sites without extra DB lookups.
    isChair: user.isChair ?? false,
    isProfessional: user.isProfessional ?? false,
    ownsAnyUnit: user.ownsAnyUnit ?? false,
    isAuditor: user.isAuditor ?? false,
  };
}
