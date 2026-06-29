import { unauthorized, forbidden } from "next/navigation";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { hasMinimumRole } from "@/lib/rbac";

/**
 * Page-facing auth guards. The shared `requireBuildingContext` /
 * `requireFeature` helpers serve BOTH API routes (which must return JSON)
 * and RSC pages, so they only ever throw. These wrappers translate those
 * throws into the dedicated page boundaries (`unauthorized.tsx` / `forbidden.tsx`)
 * via Next's `unauthorized()` / `forbidden()` — RSC pages only.
 *
 * API routes keep calling `requireBuildingContext` / `requireFeature` directly.
 */

/** Like requireBuildingContext, but a missing session renders the 401 page. */
export async function requirePageContext(): Promise<
  Awaited<ReturnType<typeof requireBuildingContext>>
> {
  try {
    return await requireBuildingContext();
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      unauthorized();
    }
    throw err;
  }
}

/** Like requireFeature, but a disabled feature renders the 403 page. */
export async function requirePageFeature(
  buildingId: string,
  feature: Parameters<typeof requireFeature>[1],
): Promise<void> {
  try {
    await requireFeature(buildingId, feature);
  } catch (err) {
    if (err instanceof FeatureGateError) {
      forbidden();
    }
    throw err;
  }
}

/** Renders the 403 page when the role is below `minimumRole`. */
export function requirePageRole(role: string, minimumRole: string): void {
  if (!hasMinimumRole(role, minimumRole)) {
    forbidden();
  }
}
