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

const { POST } = await import("@/app/api/finance/import/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

const SAMPLE_CSV = `date,description,debit,credit
2026-03-15,Test debit row,1000,
2026-03-16,Test credit row,,2000
`;

describe("POST /api/finance/import", () => {
  it("creates ledger entries from CSV and writes an audit log", async () => {
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

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
      isChair: true, // import → manage.budget (representative authority)
    });

    const req = new NextRequest("http://test/api/finance/import", {
      method: "POST",
      body: JSON.stringify({
        csv: SAMPLE_CSV,
        debitAccountId: expense.id,
        creditAccountId: cash.id,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(2);

    const entries = await prisma.ledgerEntry.count({
      where: {
        OR: [{ debitAccountId: expense.id }, { creditAccountId: expense.id }],
      },
    });
    expect(entries).toBe(2);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "LedgerEntry", entityId: "csv-import" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects with 400 when the debit account is from a different building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherExpense = await prisma.account.create({
      data: {
        buildingId: otherBuilding.id,
        name: "Other Cleaning",
        type: "EXPENSE",
      },
    });
    const cash = await prisma.account.create({
      data: { buildingId: building.id, name: "Cash", type: "ASSET" },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
      isChair: true, // import → manage.budget (representative authority)
    });

    const req = new NextRequest("http://test/api/finance/import", {
      method: "POST",
      body: JSON.stringify({
        csv: SAMPLE_CSV,
        debitAccountId: otherExpense.id,
        creditAccountId: cash.id,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const entries = await prisma.ledgerEntry.count({});
    expect(entries).toBe(0);
  });

  it("returns 200 with zero created when CSV has no valid rows", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
      isChair: true, // import → manage.budget (representative authority)
    });

    const req = new NextRequest("http://test/api/finance/import", {
      method: "POST",
      body: JSON.stringify({ csv: "date,description,debit,credit\n" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
  });
});
