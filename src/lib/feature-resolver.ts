import { FEATURE_DEPENDENCIES, type Feature } from "./features";

/**
 * Global feature-flag state (mirrors the Prisma `FeatureFlagState` enum).
 * - PER_PLAN    — defer to the plan catalog (default).
 * - FORCE_ON    — available to every building (rollout).
 * - KILL_SWITCH — unavailable to everyone, absolute.
 */
export type FeatureFlagState = "PER_PLAN" | "FORCE_ON" | "KILL_SWITCH";

/**
 * Per-feature precedence resolution. Pure — no DB — so it's exhaustively
 * unit-testable. Inputs are loaded by the caller (getActiveFeatures).
 *
 * Precedence (highest wins):
 *   1. KILL_SWITCH        → false (absolute)
 *   2. building override  → grant/revoke wins over plan + force-on
 *   3. FORCE_ON           → true
 *   4. plan default
 *
 * Plan: docs/plans/2026-06-23-superadmin-feature-management.md (Phase 2).
 */
export function resolveFeature(args: {
  /** PlanFeature.enabled for the building's plan (trial rule pre-applied). */
  planEnabled: boolean;
  flagState: FeatureFlagState;
  /** BuildingFeatureOverride.grant, or null if none / expired. */
  override: boolean | null;
}): boolean {
  if (args.flagState === "KILL_SWITCH") return false; // 1. absolute
  if (args.override !== null) return args.override; // 2. building override
  if (args.flagState === "FORCE_ON") return true; // 3. global rollout
  return args.planEnabled; // 4. plan default
}

/**
 * Dependency cascade — drop any feature whose prerequisites aren't all
 * present. Iterates to a fixpoint so transitive chains collapse correctly
 * (e.g. kill-switching finance.ledger removes finance.bank-sync-live via
 * finance.bank-csv). Runs AFTER per-feature resolution.
 */
export function applyDependencies(enabled: Set<Feature>): Set<Feature> {
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of [...enabled]) {
      const deps = FEATURE_DEPENDENCIES[f] ?? [];
      if (deps.some((d) => !enabled.has(d))) {
        enabled.delete(f);
        changed = true;
      }
    }
  }
  return enabled;
}
