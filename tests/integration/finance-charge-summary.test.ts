import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

const { requireBuildingContextMock } = vi.hoisted(() => ({
  requireBuildingContextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireBuildingContext: requireBuildingContextMock,
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));

const { GET } = await import("@/app/api/finance/charges/summary/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

async function seedUnitWithCharges(buildingId: string) {
  const unit = await prisma.unit.create({
    data: {
      buildingId,
      number: "1.A",
      floor: 1,
      ownershipShare: 0.05,
      size: 50,
    },
  });
  // 2 unpaid + 1 paid charge.
  await prisma.monthlyCharge.create({
    data: {
      unitId: unit.id,
      month: "2026-04",
      amount: 25000,
      status: "UNPAID",
    },
  });
  await prisma.monthlyCharge.create({
    data: {
      unitId: unit.id,
      month: "2026-05",
      amount: 25000,
      status: "UNPAID",
    },
  });
  await prisma.monthlyCharge.create({
    data: {
      unitId: unit.id,
      month: "2026-03",
      amount: 25000,
      status: "PAID",
      paidAt: new Date("2026-03-15"),
    },
  });
  return unit;
}

describe("GET /api/finance/charges/summary", () => {
  it("board with unitId returns the summary for that unit", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const unit = await seedUnitWithCharges(building.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(
      new NextRequest(
        `http://test/api/finance/charges/summary?unitId=${unit.id}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Number(body.currentBalance)).toBe(50000);
    expect(body.nextDue.month).toBe("2026-04");
    expect(body.lastPayment).not.toBeNull();
  });

  it("board with a unitId from another building gets the empty shape", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherUnit = await prisma.unit.create({
      data: {
        buildingId: otherBuilding.id,
        number: "X.1",
        floor: 1,
        ownershipShare: 0.05,
        size: 50,
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(
      new NextRequest(
        `http://test/api/finance/charges/summary?unitId=${otherUnit.id}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentBalance).toBe(0);
    expect(body.nextDue).toBeNull();
    expect(body.lastPayment).toBeNull();
  });

  it("resident with no unit returns the empty shape", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });

    requireBuildingContextMock.mockResolvedValue({
      userId: user.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await GET(
      new NextRequest("http://test/api/finance/charges/summary"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.currentBalance).toBe(0);
  });
});
