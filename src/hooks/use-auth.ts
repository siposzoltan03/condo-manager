"use client";

import { useSession } from "next-auth/react";
import {
  allows,
  allowsAny,
  type BuildingActor,
  type Capability,
  type CapabilityOpts,
} from "@/lib/authz";

export function useAuth() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const user = session?.user ?? null;

  // The capability matrix is pure, so it runs client-side too. Build the
  // actor from the session (the JWT carries the building flags).
  const actor: BuildingActor = {
    role: user?.activeRole ?? "TENANT",
    isChair: user?.isChair,
    ownsAnyUnit: user?.ownsAnyUnit,
    isAuditor: user?.isAuditor,
  };

  /** Client-side capability check. UI affordance only — the server re-checks
   *  every gated route/action via can(). */
  function can(cap: Capability, opts?: CapabilityOpts): boolean {
    if (!user?.activeRole) return false;
    return allows(actor, cap, opts);
  }
  /** True if the actor has ANY of the capabilities (multi-access nav). */
  function canAny(...caps: Capability[]): boolean {
    if (!user?.activeRole) return false;
    return allowsAny(actor, ...caps);
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    can,
    canAny,
    activeBuildingId: user?.activeBuildingId ?? null,
    activeRole: user?.activeRole ?? null,
    buildings: user?.buildings ?? [],
  };
}
