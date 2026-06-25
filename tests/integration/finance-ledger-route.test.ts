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

const { GET, POST } = await import("@/app/api/finance/ledger/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

async function seedAccounts(buildingId: string) {
  const cash = await prisma.account.create({
    data: { buildingId, name: "Cash", type: "ASSET" },
  });
  const expense = await prisma.account.create({
    data: { buildingId, name: "Cleaning", type: "EXPENSE" },
  });
  return { cash, expense };
}

describe("GET /api/finance/ledger", () => {
  it("returns the building's entries, isolated from other buildings", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const accts = await seedAccounts(building.id);
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-03-01"),
        description: "Own entry",
        amount: 5000,
        debitAccountId: accts.expense.id,
        creditAccountId: accts.cash.id,
        createdById: board.id,
      },
    });
    const otherAccts = await seedAccounts(otherBuilding.id);
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-03-01"),
        description: "Other entry",
        amount: 9999,
        debitAccountId: otherAccts.expense.id,
        creditAccountId: otherAccts.cash.id,
        createdById: board.id,
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(new NextRequest("http://test/api/finance/ledger"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.entries[0].description).toBe("Own entry");
  });

  it("returns the empty page when accountId is from another building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherAccts = await seedAccounts(otherBuilding.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(
      new NextRequest(
        `http://test/api/finance/ledger?accountId=${otherAccts.cash.id}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
  });
});

describe("POST /api/finance/ledger", () => {
  it("creates a ledger entry and writes an audit log", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const accts = await seedAccounts(building.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/finance/ledger", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-04-01",
        debitAccountId: accts.expense.id,
        creditAccountId: accts.cash.id,
        amount: 1500,
        description: "supplies",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "LedgerEntry", entityId: body.id },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects with 400 when an account is from a different building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const ownAccts = await seedAccounts(building.id);
    const otherAccts = await seedAccounts(otherBuilding.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/finance/ledger", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-04-01",
        debitAccountId: otherAccts.expense.id,
        creditAccountId: ownAccts.cash.id,
        amount: 1500,
        description: "cross-tenant attempt",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const count = await prisma.ledgerEntry.count({});
    expect(count).toBe(0);
  });
});
