import { describe, it, expect } from "vitest";
import { resolveFeature, applyDependencies } from "@/lib/feature-resolver";
import type { Feature } from "@/lib/features";

/**
 * Truth-table coverage for the pure feature-resolver precedence + dependency
 * cascade. No DB — inputs are exactly what getActiveFeatures loads.
 *
 * Precedence (highest wins): KILL_SWITCH > building override > FORCE_ON > plan.
 */
describe("resolveFeature — precedence", () => {
  it("KILL_SWITCH is absolute — false regardless of override / force-on / plan", () => {
    for (const override of [true, false, null] as const) {
      for (const planEnabled of [true, false]) {
        expect(
          resolveFeature({ flagState: "KILL_SWITCH", override, planEnabled }),
        ).toBe(false);
      }
    }
  });

  it("a building override wins over FORCE_ON and the plan default", () => {
    // grant overrides a plan that doesn't include it
    expect(resolveFeature({ flagState: "PER_PLAN", override: true, planEnabled: false })).toBe(true);
    // revoke overrides FORCE_ON
    expect(resolveFeature({ flagState: "FORCE_ON", override: false, planEnabled: true })).toBe(false);
    // grant overrides FORCE_ON (redundant but must hold)
    expect(resolveFeature({ flagState: "FORCE_ON", override: true, planEnabled: false })).toBe(true);
  });

  it("FORCE_ON grants to everyone when there is no override", () => {
    expect(resolveFeature({ flagState: "FORCE_ON", override: null, planEnabled: false })).toBe(true);
    expect(resolveFeature({ flagState: "FORCE_ON", override: null, planEnabled: true })).toBe(true);
  });

  it("PER_PLAN with no override defers to the plan default", () => {
    expect(resolveFeature({ flagState: "PER_PLAN", override: null, planEnabled: true })).toBe(true);
    expect(resolveFeature({ flagState: "PER_PLAN", override: null, planEnabled: false })).toBe(false);
  });
});

describe("applyDependencies — cascade to a fixpoint", () => {
  const set = (...fs: Feature[]) => new Set<Feature>(fs);

  it("keeps a feature whose prerequisite is present", () => {
    const out = applyDependencies(set("voting.basic", "voting.weighted"));
    expect(out.has("voting.weighted")).toBe(true);
    expect(out.has("voting.basic")).toBe(true);
  });

  it("drops a feature whose direct prerequisite is missing", () => {
    const out = applyDependencies(set("voting.weighted")); // no voting.basic
    expect(out.has("voting.weighted")).toBe(false);
  });

  it("keeps a full dependency chain when every link is present", () => {
    const out = applyDependencies(
      set("finance.ledger", "finance.bank-csv", "finance.bank-sync-live"),
    );
    expect(out.has("finance.bank-sync-live")).toBe(true);
    expect(out.has("finance.bank-csv")).toBe(true);
    expect(out.has("finance.ledger")).toBe(true);
  });

  it("collapses a transitive chain when the root is removed", () => {
    // bank-sync-live → bank-csv → ledger. Without ledger, both must drop.
    const out = applyDependencies(set("finance.bank-csv", "finance.bank-sync-live"));
    expect(out.has("finance.bank-csv")).toBe(false);
    expect(out.has("finance.bank-sync-live")).toBe(false);
  });

  it("drops only the link whose prerequisite is missing (partial chain)", () => {
    // ledger present, bank-csv missing → bank-sync-live drops, ledger stays.
    const out = applyDependencies(set("finance.ledger", "finance.bank-sync-live"));
    expect(out.has("finance.ledger")).toBe(true);
    expect(out.has("finance.bank-sync-live")).toBe(false);
  });

  it("leaves a dependency-free feature untouched", () => {
    const out = applyDependencies(set("voting.basic"));
    expect(out.has("voting.basic")).toBe(true);
  });
});
