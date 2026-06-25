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

const { GET: accountsGET } = await import("@/app/api/finance/accounts/route");
const { GET: exportGET } = await import(
  "@/app/api/finance/ledger/export/route"
);

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("GET /api/finance/accounts", () => {
  it("returns only the requesting building's accounts (cross-tenant safe)", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    await prisma.account.create({
      data: { buildingId: building.id, name: "Cash", type: "ASSET" },
    });
    await prisma.account.create({
      data: {
        buildingId: otherBuilding.id,
        name: "Other Building Cash",
        type: "ASSET",
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await accountsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Cash");
  });
});

describe("GET /api/finance/ledger/export", () => {
  it("returns CSV with this building's ledger entries only", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const debit = await prisma.account.create({
      data: { buildingId: building.id, name: "Cash", type: "ASSET" },
    });
    const credit = await prisma.account.create({
      data: { buildingId: building.id, name: "Income", type: "INCOME" },
    });
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-04-15"),
        description: "April rent",
        amount: 100000,
        debitAccountId: debit.id,
        creditAccountId: credit.id,
        createdById: board.id,
      },
    });

    // Other building's entry — must NOT appear.
    const otherDebit = await prisma.account.create({
      data: { buildingId: otherBuilding.id, name: "Cash", type: "ASSET" },
    });
    const otherCredit = await prisma.account.create({
      data: { buildingId: otherBuilding.id, name: "Income", type: "INCOME" },
    });
    await prisma.ledgerEntry.create({
      data: {
        date: new Date("2026-04-15"),
        description: "Other building rent",
        amount: 999999,
        debitAccountId: otherDebit.id,
        creditAccountId: otherCredit.id,
        createdById: board.id,
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await exportGET(
      new NextRequest("http://test/api/finance/ledger/export"),
    );
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("April rent");
    expect(csv).not.toContain("Other building rent");
  });
});
