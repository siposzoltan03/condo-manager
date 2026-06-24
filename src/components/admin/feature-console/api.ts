import type {
  CatalogFeature,
  PlanMatrix,
  BuildingOverrideView,
} from "@/lib/feature-access";
import type { FeatureFlagState } from "@/lib/feature-resolver";

/** Client fetch helpers for the superadmin feature-management API. */

async function asJson(res: Response) {
  return res.json().catch(() => null);
}

export async function fetchCatalog(): Promise<CatalogFeature[]> {
  const res = await fetch("/api/admin/features", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Failed to load features");
  return (await asJson(res)).features as CatalogFeature[];
}

export async function patchFeature(
  id: string,
  body: { name?: string; description?: string | null; isActive?: boolean; flagState?: FeatureFlagState }
): Promise<void> {
  const res = await fetch(`/api/admin/features/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update feature");
}

export async function fetchMatrix(): Promise<PlanMatrix> {
  const res = await fetch("/api/admin/plans", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Failed to load plans");
  return (await asJson(res)) as PlanMatrix;
}

export type ToggleResult = { ok: true } | { ok: false; blocker: string };

export async function togglePlanFeature(
  planId: string,
  featureId: string,
  enabled: boolean
): Promise<ToggleResult> {
  const res = await fetch(`/api/admin/plans/${planId}/features`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ featureId, enabled }),
  });
  if (res.status === 409) {
    const body = await asJson(res);
    return { ok: false, blocker: body?.blocker ?? "" };
  }
  if (!res.ok) throw new Error("Failed to toggle plan feature");
  return { ok: true };
}

export async function patchPlan(
  planId: string,
  body: Partial<{
    maxBuildings: number;
    maxUnitsPerBuilding: number;
    priceMonthly: string;
    priceYearly: string;
    trialDays: number;
    isActive: boolean;
    stripePriceId: string | null;
  }>
): Promise<void> {
  const res = await fetch(`/api/admin/plans/${planId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update plan");
}

export async function fetchOverrideView(
  buildingId: string
): Promise<BuildingOverrideView> {
  const res = await fetch(`/api/admin/buildings/${buildingId}/feature-overrides`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error("Failed to load overrides");
  return (await asJson(res)) as BuildingOverrideView;
}

export async function putOverride(
  buildingId: string,
  body: { featureId: string; grant: boolean; reason?: string | null; expiresAt?: string | null }
): Promise<void> {
  const res = await fetch(`/api/admin/buildings/${buildingId}/feature-overrides`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to set override");
}

export async function deleteOverride(
  buildingId: string,
  featureId: string
): Promise<void> {
  const res = await fetch(`/api/admin/buildings/${buildingId}/feature-overrides`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ featureId }),
  });
  if (!res.ok) throw new Error("Failed to clear override");
}
