import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Role gating for the board-only finance reads. These now use
 * can(actor, "view.building.finance") (BOARD_MEMBER / ADMIN / AUDITOR) — the
 * legacy hasMinimumRole gate was migrated to the capability matrix.
 *
 * Note: SUPER_ADMIN is now DENIED (403) — the matrix grants it no building
 * powers (strict can(); building impersonation is a separate future flow).
 * This is the post-migration behavior (was 200 under the legacy hierarchy).
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
  { role: "SUPER_ADMIN", expected: 403 }, // strict can(): no building powers
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
