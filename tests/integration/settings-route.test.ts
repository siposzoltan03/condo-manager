import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { makeBuilding, makeUser } from "../fixtures";

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

const { GET, PATCH } = await import("@/app/api/settings/route");

function asSessionUser(opts: {
  id: string;
  activeBuildingId?: string;
  activeRole?: string;
}) {
  return {
    id: opts.id,
    name: "Test",
    email: "test@test.local",
    activeBuildingId: opts.activeBuildingId,
    activeRole: opts.activeRole ?? "RESIDENT",
  };
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
});

describe("GET /api/settings", () => {
  it("returns the current user's settings + unit info", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });
    // Attach the user to a unit.
    const unit = await prisma.unit.create({
      data: {
        buildingId: building.id,
        number: "1.A",
        size: 50,
        floor: 1,
        ownershipShare: 0.05,
      },
    });
    await prisma.unitUser.create({
      data: { userId: user.id, unitId: unit.id, relationship: "OWNER" },
    });

    getCurrentUserMock.mockResolvedValue(
      asSessionUser({ id: user.id, activeBuildingId: building.id }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.id);
    expect(body.unit).toEqual({ number: "1.A" });
  });

  it("returns null unit when the user has no unit in the active building", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });

    getCurrentUserMock.mockResolvedValue(
      asSessionUser({ id: user.id, activeBuildingId: building.id }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unit).toBeNull();
  });
});

describe("PATCH /api/settings", () => {
  it("updates the user's name", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });

    getCurrentUserMock.mockResolvedValue(
      asSessionUser({ id: user.id, activeBuildingId: building.id }),
    );

    const req = new Request("http://test", {
      method: "PATCH",
      body: JSON.stringify({ name: "Renamed Person" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req as never);
    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.name).toBe("Renamed Person");
  });

  it("rejects password change with wrong current password (403)", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({
      buildingId: building.id,
      password: "correct-password-123",
    });

    getCurrentUserMock.mockResolvedValue(
      asSessionUser({ id: user.id, activeBuildingId: building.id }),
    );

    const oldHash = (await prisma.user.findUnique({ where: { id: user.id } }))!
      .passwordHash;

    const req = new Request("http://test", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "wrong-password",
        newPassword: "NewPassword123!",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req as never);
    expect(res.status).toBe(403);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.passwordHash).toBe(oldHash);
  });

  it("changes password with correct current + valid new", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({
      buildingId: building.id,
      password: "correct-password-123",
    });
    // Override the password hash to match a known value the test controls.
    const realHash = await hash("correct-password-123", 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: realHash },
    });

    getCurrentUserMock.mockResolvedValue(
      asSessionUser({ id: user.id, activeBuildingId: building.id }),
    );

    const req = new Request("http://test", {
      method: "PATCH",
      body: JSON.stringify({
        currentPassword: "correct-password-123",
        newPassword: "NewPassword123!",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req as never);
    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.passwordHash).not.toBe(realHash);
  });
});
