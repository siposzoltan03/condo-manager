import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { makeUser, makeBuilding } from "../fixtures";

const { userMock } = vi.hoisted(() => ({ userMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: userMock, auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }) }));

const { POST } = await import("@/app/api/auth/change-password/route");

beforeEach(() => userMock.mockReset());

const req = (body: unknown) =>
  new NextRequest("http://test/api/auth/change-password", { method: "POST", body: JSON.stringify(body) });

async function userWithPassword(pw: string) {
  const { building } = await makeBuilding();
  const u = await makeUser({ buildingId: building.id, role: "OWNER" });
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw) } });
  return u;
}

describe("POST /api/auth/change-password", () => {
  it("401 when unauthenticated", async () => {
    userMock.mockResolvedValue(null);
    expect((await POST(req({ currentPassword: "x", newPassword: "Newpass123!" }))).status).toBe(401);
  });

  it("rejects a wrong current password", async () => {
    const u = await userWithPassword("Oldpass123!");
    userMock.mockResolvedValue({ id: u.id });
    const res = await POST(req({ currentPassword: "WRONGpass1!", newPassword: "Newpass123!" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("WRONG_CURRENT");
  });

  it("changes the password with a correct current password", async () => {
    const u = await userWithPassword("Oldpass123!");
    userMock.mockResolvedValue({ id: u.id });
    const res = await POST(req({ currentPassword: "Oldpass123!", newPassword: "Newpass123!" }));
    expect(res.status).toBe(200);
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { passwordHash: true } });
    expect(await verifyPassword("Newpass123!", row!.passwordHash!)).toBe(true);
    expect(await verifyPassword("Oldpass123!", row!.passwordHash!)).toBe(false);
  });

  it("rejects reusing the same password", async () => {
    const u = await userWithPassword("Oldpass123!");
    userMock.mockResolvedValue({ id: u.id });
    const res = await POST(req({ currentPassword: "Oldpass123!", newPassword: "Oldpass123!" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("SAME_PASSWORD");
  });
});
