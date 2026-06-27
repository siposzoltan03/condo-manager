import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Role-denial coverage for the board-only finance reads. Existing finance tests
 * cover the happy path + cross-tenant isolation but never assert that OWNER /
 * TENANT are rejected. These routes gate on hasMinimumRole(role, "BOARD_MEMBER")
 * — the legacy flat hierarchy (src/lib/rbac.ts).
 *
 * Note: SUPER_ADMIN PASSES this gate (hierarchy level 5 >= 3) even though the
 * can() capability matrix grants SUPER_ADMIN no building-level powers. That's a
 * known legacy↔can() migration gap; we assert the ACTUAL behavior here.
 */

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

// Isolate the ROLE gate from the FEATURE gate — always let the feature through.
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));

const { GET: accountsGET } = await import("@/app/api/finance/accounts/route");
const { GET: ledgerExportGET } = await import(
  "@/app/api/finance/ledger/export/route"
);

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

// expected status per role for a board-only finance read
const LADDER: { role: BuildingRole; expected: number }[] = [
  { role: "TENANT", expected: 403 },
  { role: "OWNER", expected: 403 },
  { role: "BOARD_MEMBER", expected: 200 },
  { role: "ADMIN", expected: 200 },
  { role: "SUPER_ADMIN", expected: 200 }, // legacy hierarchy lets superadmin through
];

async function asRole(role: BuildingRole) {
  const { building } = await makeBuilding();
  const user = await makeUser({ buildingId: building.id, role });
  await prisma.account.create({
    data: { buildingId: building.id, name: "Cash", type: "ASSET" },
  });
  requireBuildingContextMock.mockResolvedValue({
    userId: user.id,
    buildingId: building.id,
    role,
  });
  return building;
}

describe("GET /api/finance/accounts — role ladder", () => {
  for (const { role, expected } of LADDER) {
    it(`${role} -> ${expected}`, async () => {
      await asRole(role);
      const res = await accountsGET();
      expect(res.status).toBe(expected);
    });
  }
});

describe("GET /api/finance/ledger/export — role ladder", () => {
  for (const { role, expected } of LADDER) {
    it(`${role} -> ${expected}`, async () => {
      await asRole(role);
      const res = await ledgerExportGET(
        new NextRequest("http://test/api/finance/ledger/export"),
      );
      expect(res.status).toBe(expected);
    });
  }
});
