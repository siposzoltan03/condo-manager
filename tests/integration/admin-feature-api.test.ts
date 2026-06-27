import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole } from "@prisma/client";

/**
 * The /api/admin/* feature-console routes must be SUPER_ADMIN-only. They all
 * share requireSuperAdmin() = requireBuildingContext() + hasMinimumRole(role,
 * "SUPER_ADMIN"), so ADMIN (hierarchy level 4) is correctly below SUPER_ADMIN
 * (5) and rejected. Locks that every admin endpoint denies non-superadmins.
 */

const { requireBuildingContextMock } = vi.hoisted(() => ({
  requireBuildingContextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireBuildingContext: requireBuildingContextMock,
  getCurrentUser: vi.fn(),
  auth: vi.fn(),
  getSession: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const { GET: featuresGET } = await import("@/app/api/admin/features/route");
const { GET: plansGET } = await import("@/app/api/admin/plans/route");
const { PATCH: featuresPATCH } = await import(
  "@/app/api/admin/features/[id]/route"
);

beforeEach(() => requireBuildingContextMock.mockReset());

function asRole(role: BuildingRole) {
  requireBuildingContextMock.mockResolvedValue({
    userId: "u1",
    buildingId: "b1",
    role,
  });
}

// Every building role that is NOT the platform superadmin.
const NON_SUPERADMIN: BuildingRole[] = [
  "TENANT",
  "OWNER",
  "BOARD_MEMBER",
  "ADMIN",
];

describe("admin API — SUPER_ADMIN guard", () => {
  describe("GET /api/admin/features", () => {
    for (const role of NON_SUPERADMIN) {
      it(`rejects ${role} with 403`, async () => {
        asRole(role);
        expect((await featuresGET()).status).toBe(403);
      });
    }
    it("allows SUPER_ADMIN", async () => {
      asRole("SUPER_ADMIN");
      expect((await featuresGET()).status).toBe(200);
    });
  });

  describe("GET /api/admin/plans", () => {
    for (const role of NON_SUPERADMIN) {
      it(`rejects ${role} with 403`, async () => {
        asRole(role);
        expect((await plansGET()).status).toBe(403);
      });
    }
    it("allows SUPER_ADMIN", async () => {
      asRole("SUPER_ADMIN");
      expect((await plansGET()).status).toBe(200);
    });
  });

  describe("PATCH /api/admin/features/[id] — mutations are locked too", () => {
    it("rejects ADMIN with 403 before touching the body", async () => {
      asRole("ADMIN");
      const res = await featuresPATCH(
        new NextRequest("http://test/api/admin/features/x", {
          method: "PATCH",
          body: "{}",
        }),
        { params: Promise.resolve({ id: "x" }) },
      );
      expect(res.status).toBe(403);
    });
  });
});
