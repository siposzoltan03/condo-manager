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

const { GET } = await import("@/app/api/finance/summary/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("GET /api/finance/summary", () => {
  it("aggregates income/expenses/current-fund/reserve-fund for the building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const cash = await prisma.account.create({
      data: { buildingId: building.id, name: "Cash", type: "ASSET" },
    });
    const reserve = await prisma.account.create({
      data: { buildingId: building.id, name: "Reserve fund", type: "ASSET" },
    });
    const income = await prisma.account.create({
      data: { buildingId: building.id, name: "Income", type: "INCOME" },
    });
    const expense = await prisma.account.create({
      data: { buildingId: building.id, name: "Expense", type: "EXPENSE" },
    });
    // Income: credit Income, debit Cash → 100k
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-03-01"),
        description: "rent",
        amount: 100000,
        debitAccountId: cash.id,
        creditAccountId: income.id,
        createdById: board.id,
      },
    });
    // Reserve contribution: credit Reserve, debit Cash → 20k
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-03-02"),
        description: "reserve contribution",
        amount: 20000,
        debitAccountId: reserve.id,
        creditAccountId: cash.id,
        createdById: board.id,
      },
    });
    // Expense: debit Expense, credit Cash → 5k
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-03-03"),
        description: "supplies",
        amount: 5000,
        debitAccountId: expense.id,
        creditAccountId: cash.id,
        createdById: board.id,
      },
    });
    // Another building's entry — must NOT leak.
    const otherCash = await prisma.account.create({
      data: { buildingId: otherBuilding.id, name: "Cash", type: "ASSET" },
    });
    const otherIncome = await prisma.account.create({
      data: { buildingId: otherBuilding.id, name: "Income", type: "INCOME" },
    });
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-03-01"),
        description: "other rent",
        amount: 999999,
        debitAccountId: otherCash.id,
        creditAccountId: otherIncome.id,
        createdById: board.id,
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(
      new NextRequest(
        "http://test/api/finance/summary?from=2026-01-01&to=2026-12-31",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalIncome).toBe(100000);
    expect(body.totalExpenses).toBe(5000);
    // Current fund (Cash): debit 100k (income), credit 20k (to reserve)
    // + credit 5k (expense). Net = 100k - 20k - 5k = 75k.
    expect(body.currentFundBalance).toBe(75000);
    // Reserve fund: debit 20k. Net = 20k.
    expect(body.reserveFundBalance).toBe(20000);
  });

  it("returns 403 for non-board roles", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });

    requireBuildingContextMock.mockResolvedValue({
      userId: user.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await GET(
      new NextRequest("http://test/api/finance/summary"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid date params", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const res = await GET(
      new NextRequest("http://test/api/finance/summary?from=not-a-date"),
    );
    expect(res.status).toBe(400);
  });
});
