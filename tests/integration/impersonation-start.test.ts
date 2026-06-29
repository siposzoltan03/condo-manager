import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BuildingRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * POST /api/impersonation/start begins a SUPER_ADMIN read-only impersonation.
 * Guards: non-superadmin → 403; non-member target → 404. On success it returns
 * the impersonated member's *effective* context (role + flags computed from
 * their memberships, exactly like login hydration) and writes an
 * `impersonate.start` audit row under the REAL superadmin id.
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

const { POST: startPOST } = await import("@/app/api/impersonation/start/route");

beforeEach(() => requireBuildingContextMock.mockReset());

/** The mock requireBuildingContext resolves to a ctx with the given role + id. */
function asSuperAdmin(userId: string, buildingId: string) {
  requireBuildingContextMock.mockResolvedValue({
    userId,
    buildingId,
    role: "SUPER_ADMIN" as BuildingRole,
    isChair: false,
    isProfessional: false,
    ownsAnyUnit: false,
    isAuditor: false,
    impersonating: false,
    realUserId: userId,
  });
}

function asRole(userId: string, buildingId: string, role: BuildingRole) {
  requireBuildingContextMock.mockResolvedValue({
    userId,
    buildingId,
    role,
    isChair: false,
    isProfessional: false,
    ownsAnyUnit: false,
    isAuditor: false,
    impersonating: false,
    realUserId: userId,
  });
}

function req(body: unknown) {
  return new Request("http://test/api/impersonation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/impersonation/start", () => {
  it("rejects a non-superadmin with 403", async () => {
    const { building } = await makeBuilding();
    const sa = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const member = await makeUser({ buildingId: building.id, role: "OWNER" });
    asRole(sa.id, building.id, "ADMIN");

    const res = await startPOST(req({ buildingId: building.id, userId: member.id }));
    expect(res.status).toBe(403);
  });

  it("404s when the target is not an active member of the building", async () => {
    const { building } = await makeBuilding();
    const sa = await makeUser({ buildingId: building.id, role: "SUPER_ADMIN" });
    const outsider = await makeUser({ buildingId: building.id, role: "OWNER" });
    // Outsider belongs to `building` but we ask to impersonate them in a
    // building they are NOT a member of → no UserBuilding row → 404.
    const { building: otherBuilding } = await makeBuilding();
    asSuperAdmin(sa.id, building.id);

    const res = await startPOST(
      req({ buildingId: otherBuilding.id, userId: outsider.id }),
    );
    expect(res.status).toBe(404);
  });

  it("returns the member's effective context and audits impersonate.start", async () => {
    const { building } = await makeBuilding();
    const sa = await makeUser({ buildingId: building.id, role: "SUPER_ADMIN" });
    const member = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
      name: "Member One",
    });
    asSuperAdmin(sa.id, building.id);

    const res = await startPOST(req({ buildingId: building.id, userId: member.id }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      userId: member.id,
      userName: "Member One",
      buildingId: building.id,
      role: "BOARD_MEMBER",
      isChair: false,
      ownsAnyUnit: false,
      isAuditor: false,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "impersonate.start", entityId: member.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(sa.id); // logged under the REAL superadmin
    expect(audit?.buildingId).toBe(building.id);
  });

  it("reflects ownsAnyUnit when the member owns a unit", async () => {
    const { building } = await makeBuilding();
    const sa = await makeUser({ buildingId: building.id, role: "SUPER_ADMIN" });
    const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
    const unit = await prisma.unit.create({
      data: {
        buildingId: building.id,
        number: "A1",
        floor: 1,
        ownershipShare: "0.1000",
        size: "55.00",
      },
    });
    await prisma.unitUser.create({
      data: { unitId: unit.id, userId: owner.id, relationship: "OWNER" },
    });
    asSuperAdmin(sa.id, building.id);

    const res = await startPOST(req({ buildingId: building.id, userId: owner.id }));
    expect(res.status).toBe(200);
    expect((await res.json()).ownsAnyUnit).toBe(true);
  });
});
