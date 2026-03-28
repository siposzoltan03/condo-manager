"use client";

import { useSession } from "next-auth/react";
import { hasMinimumRole } from "@/lib/rbac";

export function useAuth() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const user = session?.user ?? null;

  function hasRole(minimumRole: string): boolean {
    if (!user?.activeRole) return false;
    return hasMinimumRole(user.activeRole, minimumRole);
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    hasRole,
    activeBuildingId: user?.activeBuildingId ?? null,
    activeRole: user?.activeRole ?? null,
    buildings: user?.buildings ?? [],
  };
}
