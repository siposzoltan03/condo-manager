import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { makeBuilding } from "../fixtures";
import type { ImportRow } from "@/lib/import/types";

/**
 * Onboarding 100%-share gate: a units import is rejected if the building's
 * ownership shares would exceed 100% (existing + imported); under 100% commits
 * but reports incomplete; exactly 100% reports complete.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireCapability: vi.fn(), allows: vi.fn(() => true) }));
vi.mock("@/lib/frozen-check", () => ({ requireNotFrozen: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/plan-limits", () => ({ checkUnitLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, max: -1 }) }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { importUnits } = await import("@/app/actions/units");

beforeEach(() => ctxMock.mockReset());

function rows(specs: [string, string][]): ImportRow[] {
  // [unit_number, ownership_share]
  return specs.map(([n, s]) => ({ unit_number: n, floor: "1", size_sqm: "50", ownership_share: s }));
}

async function buildingCtx() {
  const { building } = await makeBuilding();
  ctxMock.mockResolvedValue({ userId: "u1", buildingId: building.id, role: "ADMIN", ownsAnyUnit: false });
  return building;
}

describe("units import — 100% share gate", () => {
  it("rejects an import that would exceed 100%", async () => {
    await buildingCtx();
    const res = await importUnits(rows([["A", "0.6"], ["B", "0.5"]])); // 110%
    expect(res.created).toBe(0);
    expect(res.errors[0].message).toMatch(/exceed 100%/i);
    expect(await prisma.unit.count()).toBe(0);
  });

  it("commits a full 100% import and flags it complete", async () => {
    await buildingCtx();
    const res = await importUnits(rows([["A", "0.5000"], ["B", "0.5000"]]));
    expect(res.created).toBe(2);
    expect(res.summary?.buildingShareTotal).toBe("1.0000");
    expect(res.summary?.sharesComplete).toBe(true);
  });

  it("allows a partial import but flags it incomplete", async () => {
    await buildingCtx();
    const res = await importUnits(rows([["A", "0.4000"]]));
    expect(res.created).toBe(1);
    expect(res.summary?.sharesComplete).toBe(false);
  });

  it("counts existing units toward the cap (second batch overshoots)", async () => {
    const building = await buildingCtx();
    await prisma.unit.create({
      data: { number: "X", floor: 1, size: new Prisma.Decimal(50), ownershipShare: new Prisma.Decimal("0.7000"), buildingId: building.id },
    });
    const res = await importUnits(rows([["A", "0.4000"]])); // 0.7 + 0.4 = 110%
    expect(res.created).toBe(0);
    expect(res.errors[0].message).toMatch(/exceed 100%/i);
  });
});
