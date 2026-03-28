"use client";

import { useAuth } from "@/hooks/use-auth";

export function useBuilding() {
  const { user } = useAuth();
  return {
    activeBuildingId: user?.activeBuildingId ?? null,
    activeRole: user?.activeRole ?? null,
    buildings: user?.buildings ?? [],
    hasMultipleBuildings: (user?.buildings?.length ?? 0) > 1,
  };
}
