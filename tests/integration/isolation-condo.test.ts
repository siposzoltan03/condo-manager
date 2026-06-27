import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Cross-building isolation for the building-switcher — the control that decides
 * which building a user is allowed to make active. Entity-level isolation
 * (finance, charges, ledger) is covered by the finance-* tests via the
 * paired-tenant pattern; this fills the gap for the switch gate itself, which
 * enforces membership in the DB (UserBuilding + isActive), not via the session.
 */

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
  requireBuildingContext: vi.fn(),
  auth: vi.fn(),
  getSession: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Cookie-setting needs a request scope we don't have when calling the handler
// directly — stub it out; we're asserting the authorization decision.
vi.mock("@/lib/building-context", () => ({
  setActiveBuildingCookie: vi.fn().mockResolvedValue(undefined),
}));

const { POST: switchPOST } = await import("@/app/api/buildings/switch/route");

function switchReq(body: unknown) {
  return new Request("http://test/api/buildings/switch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
});

describe("POST /api/buildings/switch — cross-building access", () => {
  it("allows switching to a building the user belongs to", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "OWNER" });
    getCurrentUserMock.mockResolvedValue({ id: user.id });

    const res = await switchPOST(switchReq({ buildingId: building.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.buildingId).toBe(building.id);
    expect(body.role).toBe("OWNER");
  });

  it("rejects switching to a building the user does NOT belong to (403)", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "OWNER" });
    getCurrentUserMock.mockResolvedValue({ id: user.id });

    const res = await switchPOST(switchReq({ buildingId: otherBuilding.id }));
    expect(res.status).toBe(403);
  });

  it("rejects switching to a building where membership is inactive (403)", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "OWNER" });
    // Inactive membership in the other building — must still be rejected.
    await prisma.userBuilding.create({
      data: {
        userId: user.id,
        buildingId: otherBuilding.id,
        role: "OWNER",
        isActive: false,
      },
    });
    getCurrentUserMock.mockResolvedValue({ id: user.id });

    const res = await switchPOST(switchReq({ buildingId: otherBuilding.id }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when buildingId is missing", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "OWNER" });
    getCurrentUserMock.mockResolvedValue({ id: user.id });

    const res = await switchPOST(switchReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await switchPOST(switchReq({ buildingId: "anything" }));
    expect(res.status).toBe(401);
  });
});
