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
  };
}
