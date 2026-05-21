import { describe, it, expect, vi, beforeEach } from "vitest";
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

const { PATCH } = await import("@/app/api/finance/charges/[id]/route");

async function seedUnitAndCharge(buildingId: string) {
  const unit = await prisma.unit.create({
    data: {
      buildingId,
      number: "1.A",
      floor: 1,
      ownershipShare: 0.05,
      size: 50,
    },
  });
  const charge = await prisma.monthlyCharge.create({
    data: {
      unitId: unit.id,
      month: "2026-05",
      amount: 25000,
      status: "UNPAID",
    },
  });
  return { unit, charge };
}

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("PATCH /api/finance/charges/[id]", () => {
  it("marks the charge PAID and writes an audit log", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const { charge } = await seedUnitAndCharge(building.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await PATCH(new Request("http://test") as never, {
      params: Promise.resolve({ id: charge.id }),
    });
    expect(res.status).toBe(200);

    const after = await prisma.monthlyCharge.findUnique({
      where: { id: charge.id },
    });
    expect(after!.status).toBe("PAID");
    expect(after!.paidAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MonthlyCharge", entityId: charge.id },
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe(board.id);
  });

  it("returns 404 when board in the other building tries to patch", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const otherBoard = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const { charge } = await seedUnitAndCharge(building.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: otherBoard.id,
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });

    const res = await PATCH(new Request("http://test") as never, {
      params: Promise.resolve({ id: charge.id }),
    });
    expect(res.status).toBe(404);

    const after = await prisma.monthlyCharge.findUnique({
      where: { id: charge.id },
    });
    expect(after!.status).toBe("UNPAID");
  });

  it("returns 403 for non-board roles", async () => {
    const { building } = await makeBuilding();
    const resident = await makeUser({ buildingId: building.id });
    const { charge } = await seedUnitAndCharge(building.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: resident.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await PATCH(new Request("http://test") as never, {
      params: Promise.resolve({ id: charge.id }),
    });
    expect(res.status).toBe(403);
  });
});
