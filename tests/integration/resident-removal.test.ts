import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Dual-control resident removal: one board-level user initiates, a DIFFERENT
 * one approves, and approval soft-removes (deactivates) the membership.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireCapability: vi.fn(), allows: vi.fn(() => true) }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { requestResidentRemoval, reviewResidentRemoval } = await import(
  "@/app/actions/resident-removal"
);

beforeEach(() => ctxMock.mockReset());

async function setup() {
  const { building } = await makeBuilding();
  const initiatorId = "initiator-user";
  const approverId = "approver-user";
  const target = await makeUser({ buildingId: building.id, role: "OWNER" });
  const targetUb = target.userBuildings[0];
  return { building, initiatorId, approverId, target, targetUb };
}

describe("resident removal — dual control", () => {
  it("initiates a PENDING request with a reason", async () => {
    const { building, initiatorId, targetUb } = await setup();
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    const res = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "Moved out" });
    expect(res.success).toBe(true);
    const req = await prisma.residentRemovalRequest.findUnique({ where: { id: res.requestId! } });
    expect(req?.status).toBe("PENDING");
    expect(req?.reason).toBe("Moved out");
  });

  it("requires a reason", async () => {
    const { building, initiatorId, targetUb } = await setup();
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    const res = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "  " });
    expect(res.error).toMatch(/reason/i);
  });

  it("blocks the initiator from approving their own request (2-person control)", async () => {
    const { building, initiatorId, targetUb } = await setup();
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    const req = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "x" });
    // Same user tries to approve.
    const res = await reviewResidentRemoval({ requestId: req.requestId!, approve: true });
    expect(res.error).toMatch(/different board member/i);
    const ub = await prisma.userBuilding.findUnique({ where: { id: targetUb.id } });
    expect(ub?.isActive).toBe(true); // not removed
  });

  it("a different board member approves → membership is soft-removed (deactivated)", async () => {
    const { building, initiatorId, approverId, targetUb } = await setup();
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    const req = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "x" });
    ctxMock.mockResolvedValue({ userId: approverId, buildingId: building.id, role: "ADMIN" });
    const res = await reviewResidentRemoval({ requestId: req.requestId!, approve: true, note: "ok" });
    expect(res.success).toBe(true);
    const ub = await prisma.userBuilding.findUnique({ where: { id: targetUb.id } });
    expect(ub?.isActive).toBe(false);
    const stored = await prisma.residentRemovalRequest.findUnique({ where: { id: req.requestId! } });
    expect(stored?.status).toBe("APPROVED");
    expect(stored?.reviewedById).toBe(approverId);
  });

  it("rejection keeps the membership active", async () => {
    const { building, initiatorId, approverId, targetUb } = await setup();
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    const req = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "x" });
    ctxMock.mockResolvedValue({ userId: approverId, buildingId: building.id, role: "ADMIN" });
    const res = await reviewResidentRemoval({ requestId: req.requestId!, approve: false });
    expect(res.success).toBe(true);
    const ub = await prisma.userBuilding.findUnique({ where: { id: targetUb.id } });
    expect(ub?.isActive).toBe(true);
    const stored = await prisma.residentRemovalRequest.findUnique({ where: { id: req.requestId! } });
    expect(stored?.status).toBe("REJECTED");
  });

  it("cannot remove yourself", async () => {
    const { building, targetUb, target } = await setup();
    ctxMock.mockResolvedValue({ userId: target.id, buildingId: building.id, role: "ADMIN" });
    const res = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "x" });
    expect(res.error).toMatch(/yourself/i);
  });

  it("rejects a second pending request for the same resident", async () => {
    const { building, initiatorId, targetUb } = await setup();
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "x" });
    const res = await requestResidentRemoval({ targetUserBuildingId: targetUb.id, reason: "y" });
    expect(res.error).toMatch(/already pending/i);
  });

  it("cannot remove an ADMIN via this flow", async () => {
    const { building, initiatorId } = await setup();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    ctxMock.mockResolvedValue({ userId: initiatorId, buildingId: building.id, role: "ADMIN" });
    const res = await requestResidentRemoval({ targetUserBuildingId: admin.userBuildings[0].id, reason: "x" });
    expect(res.error).toMatch(/administrator/i);
  });
});
