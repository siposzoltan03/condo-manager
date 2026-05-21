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

const { GET, POST } = await import("@/app/api/finance/budget/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("GET /api/finance/budget", () => {
  it("returns year + items with planned + actual amounts", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const expense = await prisma.account.create({
      data: { buildingId: building.id, name: "Cleaning", type: "EXPENSE" },
    });
    const cash = await prisma.account.create({
      data: { buildingId: building.id, name: "Cash", type: "ASSET" },
    });
    await prisma.budget.create({
      data: { year: 2026, accountId: expense.id, plannedAmount: 50000 },
    });
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-04-01"),
        description: "cleaning Q2",
        amount: 12000,
        debitAccountId: expense.id,
        creditAccountId: cash.id,
        createdById: board.id,
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const res = await GET(
      new NextRequest("http://test/api/finance/budget?year=2026"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].plannedAmount).toBe(50000);
    expect(body.items[0].actualAmount).toBe(12000);
  });
});

describe("POST /api/finance/budget", () => {
  it("upserts budget items and writes an audit log", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const expense = await prisma.account.create({
      data: { buildingId: building.id, name: "Cleaning", type: "EXPENSE" },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/finance/budget", {
      method: "POST",
      body: JSON.stringify({
        year: 2026,
        items: [{ accountId: expense.id, plannedAmount: 75000 }],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const budget = await prisma.budget.findFirst({
      where: { year: 2026, accountId: expense.id },
    });
    expect(budget!.plannedAmount.toString()).toBe("75000");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Budget", entityId: "year-2026" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects with 400 when an account is from a different building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherAccount = await prisma.account.create({
      data: {
        buildingId: otherBuilding.id,
        name: "Other expense",
        type: "EXPENSE",
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/finance/budget", {
      method: "POST",
      body: JSON.stringify({
        year: 2026,
        items: [{ accountId: otherAccount.id, plannedAmount: 1000 }],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const budget = await prisma.budget.findFirst({
      where: { year: 2026, accountId: otherAccount.id },
    });
    expect(budget).toBeNull();
  });
});
