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

const { GET, POST } = await import("@/app/api/finance/charges/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

async function makeUnit(buildingId: string, number: string) {
  return prisma.unit.create({
    data: {
      buildingId,
      number,
      floor: 1,
      ownershipShare: 0.05,
      size: 50,
    },
  });
}

describe("GET /api/finance/charges", () => {
  it("resident sees charges for their own unit only (paired-tenant safe)", async () => {
    const { building } = await makeBuilding();
    const resident = await makeUser({ buildingId: building.id });
    const ownUnit = await makeUnit(building.id, "1.A");
    const otherUnit = await makeUnit(building.id, "2.A");
    await prisma.unitUser.create({
      data: { userId: resident.id, unitId: ownUnit.id, relationship: "OWNER" },
    });
    await prisma.monthlyCharge.create({
      data: {
        unitId: ownUnit.id,
        month: "2026-05",
        amount: 25000,
        status: "UNPAID",
      },
    });
    await prisma.monthlyCharge.create({
      data: {
        unitId: otherUnit.id,
        month: "2026-05",
        amount: 50000,
        status: "UNPAID",
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: resident.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await GET(new NextRequest("http://test/api/finance/charges"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.charges[0].unitId).toBe(ownUnit.id);
  });

  it("board with cross-tenant unitId returns the empty page", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherUnit = await makeUnit(otherBuilding.id, "X.1");

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(
      new NextRequest(
        `http://test/api/finance/charges?unitId=${otherUnit.id}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
  });
});

describe("POST /api/finance/charges", () => {
  it("bulk-creates charges and writes an audit log", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const u1 = await makeUnit(building.id, "1.A");
    const u2 = await makeUnit(building.id, "2.A");

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/finance/charges", {
      method: "POST",
      body: JSON.stringify({
        charges: [
          { unitId: u1.id, month: "2026-05", amount: 25000 },
          { unitId: u2.id, month: "2026-05", amount: 30000 },
        ],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.count).toBe(2);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MonthlyCharge", entityId: "bulk" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects with 400 when a unitId belongs to a different building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherUnit = await makeUnit(otherBuilding.id, "X.1");

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/finance/charges", {
      method: "POST",
      body: JSON.stringify({
        charges: [{ unitId: otherUnit.id, month: "2026-05", amount: 25000 }],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const created = await prisma.monthlyCharge.count({
      where: { unitId: otherUnit.id },
    });
    expect(created).toBe(0);
  });
});
