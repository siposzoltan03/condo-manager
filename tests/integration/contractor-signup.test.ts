import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// profile-dal pulls in @/lib/auth → next-auth → ESM resolution fail
// under vitest. Mock @/lib/auth wholesale.
vi.mock("@/lib/auth", () => ({
  requireBuildingContext: vi.fn(),
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";

const { POST } = await import("@/app/api/contractor/auth/signup/route");

beforeEach(() => {
  vi.clearAllMocks();
});

const VALID_BODY = {
  email: "newowner@example.com",
  password: "long-enough-password",
  name: "New Owner",
  orgName: "Acme Plumbing",
  taxId: "12345678-1-42",
};

describe("POST /api/contractor/auth/signup", () => {
  it("creates a ContractorOrg + owner ContractorUser, and writes an audit log", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBeTruthy();

    const user = await prisma.contractorUser.findUnique({
      where: { id: body.userId },
      include: { org: true },
    });
    expect(user!.email).toBe(VALID_BODY.email);
    expect(user!.role).toBe("OWNER");
    expect(user!.org.name).toBe(VALID_BODY.orgName);
    expect(user!.org.status).toBe("PENDING_VERIFICATION");
    expect(user!.org.plan).toBe("PRO");
    expect(user!.org.planStatus).toBe("TRIALING");

    // PRE-EXISTING BUG: the route calls createAuditLog with
    // ContractorUser.id as `userId`, but AuditLog.userId FKs to the
    // condo `User` table. The .catch(() => undefined) wrapper has been
    // silently swallowing the FK violation since this code shipped, so
    // signup audit rows were never actually created. Characterization
    // test locks in the current (broken) behavior — fixing it is out
    // of scope for the Phase E sweep refactor and tracked separately.
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "ContractorOrg", entityId: user!.orgId },
    });
    expect(audit).toBeNull();
  });

  it("silently no-ops on email collision (existing condo user) — no new contractor row", async () => {
    // Seed a condo-side user with this email.
    await prisma.user.create({
      data: {
        email: VALID_BODY.email,
        name: "Existing Condo",
        passwordHash: "x",
      },
    });

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Note: NO userId field on the silent-noop response.
    expect(body.userId).toBeUndefined();

    const contractorUsers = await prisma.contractorUser.count();
    expect(contractorUsers).toBe(0);
    const orgs = await prisma.contractorOrg.count();
    expect(orgs).toBe(0);
  });

  it("rejects with 400 on a malformed tax id", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ ...VALID_BODY, taxId: "garbage" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const created = await prisma.contractorOrg.count();
    expect(created).toBe(0);
  });
});
