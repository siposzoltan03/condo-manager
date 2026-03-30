"use client";

import { useState, useEffect, useCallback } from "react";
import { useBuilding } from "@/hooks/use-building";

interface PlanData {
  planSlug: string;
  planName: string;
  features: string[];
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isLegacy: boolean;
}

export function usePlanFeatures() {
  const { activeBuildingId } = useBuilding();
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!activeBuildingId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/subscription");
      if (res.ok) {
        const data: PlanData = await res.json();
        setPlanData(data);
      }
    } catch {
      // Silently fail — treat as legacy (all features enabled)
    } finally {
      setLoading(false);
    }
  }, [activeBuildingId]);

  useEffect(() => {
    setLoading(true);
    fetchPlan();
  }, [fetchPlan]);

  const hasFeature = useCallback(
    (featureSlug: string): boolean => {
      if (!planData) return true; // Default to allowing if no data
      return planData.features.includes(featureSlug);
    },
    [planData]
  );

  return {
    features: planData?.features ?? [],
    planSlug: planData?.planSlug ?? "legacy",
    planName: planData?.planName ?? "Legacy",
    isTrialing: planData?.subscriptionStatus === "TRIALING",
    isLegacy: planData?.isLegacy ?? true,
    hasFeature,
    loading,
  };
}
