import { describe, it, expect } from "vitest";
import { deriveThresholdFlags } from "@/lib/thresholds";

const ZERO_CASH = BigInt(0);
const TWENTY_M = BigInt(20_000_000);

describe("deriveThresholdFlags — unit-count boundaries", () => {
  it("6 units: no professional manager mandate, no SZMSZ requirement", () => {
    const f = deriveThresholdFlags({ totalUnits: 6, annualCashflowHUF: ZERO_CASH });
    expect(f.requiresProfessionalManager).toBe(false);
    expect(f.szmszRequired).toBe(false);
    expect(f.requiresAuditCommittee).toBe(false);
    expect(f.requiresExternalAuditor).toBe(false);
  });

  it("7 units: SZMSZ kicks in (>=7) AND professional manager (>6)", () => {
    const f = deriveThresholdFlags({ totalUnits: 7, annualCashflowHUF: ZERO_CASH });
    expect(f.requiresProfessionalManager).toBe(true);
    expect(f.szmszRequired).toBe(true);
    expect(f.requiresAuditCommittee).toBe(false);
    expect(f.requiresExternalAuditor).toBe(false);
  });

  it("25 units: still below audit-committee threshold (>25)", () => {
    const f = deriveThresholdFlags({ totalUnits: 25, annualCashflowHUF: ZERO_CASH });
    expect(f.requiresAuditCommittee).toBe(false);
  });

  it("26 units: audit committee required", () => {
    const f = deriveThresholdFlags({ totalUnits: 26, annualCashflowHUF: ZERO_CASH });
    expect(f.requiresAuditCommittee).toBe(true);
    expect(f.requiresExternalAuditor).toBe(false);
  });

  it("50 units: still below external-auditor unit threshold (>50)", () => {
    const f = deriveThresholdFlags({ totalUnits: 50, annualCashflowHUF: ZERO_CASH });
    expect(f.requiresExternalAuditor).toBe(false);
  });

  it("51 units: external auditor required by unit count alone", () => {
    const f = deriveThresholdFlags({ totalUnits: 51, annualCashflowHUF: ZERO_CASH });
    expect(f.requiresExternalAuditor).toBe(true);
  });
});

describe("deriveThresholdFlags — annual cashflow boundaries (Tht. § 51/A)", () => {
  it("19_999_999 HUF: external auditor not required by cashflow", () => {
    const f = deriveThresholdFlags({
      totalUnits: 10,
      annualCashflowHUF: BigInt(19_999_999),
    });
    expect(f.requiresExternalAuditor).toBe(false);
  });

  it("20_000_000 HUF exactly: not required (rule is strict >)", () => {
    const f = deriveThresholdFlags({
      totalUnits: 10,
      annualCashflowHUF: TWENTY_M,
    });
    expect(f.requiresExternalAuditor).toBe(false);
  });

  it("20_000_001 HUF: external auditor required by cashflow", () => {
    const f = deriveThresholdFlags({
      totalUnits: 10,
      annualCashflowHUF: BigInt(20_000_001),
    });
    expect(f.requiresExternalAuditor).toBe(true);
  });

  it("OR logic: any one trigger (units > 50 OR cashflow > 20M) is enough", () => {
    const byCash = deriveThresholdFlags({
      totalUnits: 5,
      annualCashflowHUF: BigInt(20_000_001),
    });
    const byUnits = deriveThresholdFlags({
      totalUnits: 51,
      annualCashflowHUF: ZERO_CASH,
    });
    expect(byCash.requiresExternalAuditor).toBe(true);
    expect(byUnits.requiresExternalAuditor).toBe(true);
  });
});
