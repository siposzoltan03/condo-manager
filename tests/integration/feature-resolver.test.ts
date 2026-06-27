import { describe, it, expect } from "vitest";
import { resolveFeature } from "@/lib/feature-resolver";
import { applyDependencies } from "@/lib/feature-resolver";
import type { Feature } from "@/lib/features";

/**
 * Pure unit coverage for the feature-gating core (src/lib/feature-resolver.ts).
 * No existing test exercises the precedence rules or the dependency cascade
 * directly — this locks both. Grouped into two it() blocks (precedence, cascade)
 * to avoid per-case harness TRUNCATEs; failures show a labelled diff.
 */

describe("resolveFeature — precedence", () => {
  it("applies kill-switch > override > force-on > plan", () => {
    const cases: {
      label: string;
      input: Parameters<typeof resolveFeature>[0];
      expected: boolean;
    }[] = [
      {
        label: "kill-switch beats override + plan",
        input: { planEnabled: true, flagState: "KILL_SWITCH", override: true },
        expected: false,
      },
      {
        label: "override grant beats plan-off",
        input: { planEnabled: false, flagState: "PER_PLAN", override: true },
        expected: true,
      },
      {
        label: "override revoke beats force-on",
        input: { planEnabled: true, flagState: "FORCE_ON", override: false },
        expected: false,
      },
      {
        label: "force-on beats plan-off (no override)",
        input: { planEnabled: false, flagState: "FORCE_ON", override: null },
        expected: true,
      },
      {
        label: "plan default on (PER_PLAN, no override)",
        input: { planEnabled: true, flagState: "PER_PLAN", override: null },
        expected: true,
      },
      {
        label: "plan default off (PER_PLAN, no override)",
        input: { planEnabled: false, flagState: "PER_PLAN", override: null },
        expected: false,
      },
    ];

    const got = cases.map((c) => ({ label: c.label, r: resolveFeature(c.input) }));
    const want = cases.map((c) => ({ label: c.label, r: c.expected }));
    expect(got).toEqual(want);
  });
});

describe("applyDependencies — cascade to fixpoint", () => {
  it("drops features whose prerequisites aren't all present", () => {
    const cases: { label: string; input: Feature[]; expected: Feature[] }[] = [
      {
        label: "dependent without prereq is dropped",
        input: ["voting.weighted"],
        expected: [],
      },
      {
        label: "dependent with prereq is kept",
        input: ["voting.basic", "voting.weighted"],
        expected: ["voting.basic", "voting.weighted"],
      },
      {
        label: "transitive chain collapses when ledger is absent",
        input: ["finance.bank-csv", "finance.bank-sync-live"],
        expected: [],
      },
      {
        label: "full finance chain is kept",
        input: ["finance.ledger", "finance.bank-csv", "finance.bank-sync-live"],
        expected: ["finance.ledger", "finance.bank-csv", "finance.bank-sync-live"],
      },
      {
        label: "removing ledger cascades to every dependent",
        input: [
          "finance.budget",
          "finance.bank-csv",
          "finance.bank-sync-live",
          "finance.pdf-report",
        ],
        expected: [],
      },
      {
        label: "a feature with no dependencies stays",
        input: ["communication.forum"],
        expected: ["communication.forum"],
      },
    ];

    const got = cases.map((c) => ({
      label: c.label,
      set: [...applyDependencies(new Set(c.input))].sort(),
    }));
    const want = cases.map((c) => ({ label: c.label, set: [...c.expected].sort() }));
    expect(got).toEqual(want);
  });
});
