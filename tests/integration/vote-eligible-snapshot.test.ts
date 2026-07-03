import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * When a vote opens it records a turnout snapshot: the eligible electorate
 * (unit count + a hash of the sorted eligible unit ids) at that moment, so
 * "who was entitled to vote" is provable independently of the (secret) ballots.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn(), handlers: {} }));
vi.mock("@/lib/authz", () => ({ allows: vi.fn(() => true), requireCapability: vi.fn() }));
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class extends Error {},
}));
vi.mock("@/lib/queue", () => ({ votingQueue: { add: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/lib/voting/events", () => ({ voteCreated: vi.fn().mockResolvedValue(undefined) }));

const { POST } = await import("@/app/api/voting/votes/route");

beforeEach(() => ctxMock.mockReset());

function req(body: unknown) {
  return new NextRequest("http://test/api/voting/votes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("vote creation — eligible turnout snapshot", () => {
  it("records eligible unit count + hash at open", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    // Three eligible units in the building.
    for (const n of ["1", "2", "3"]) {
      await prisma.unit.create({
        data: { number: n, floor: 1, size: 50, ownershipShare: 0.33, buildingId: building.id },
      });
    }
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN", isChair: true });

    const res = await POST(
      req({
        title: "Teszt szavazás",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        options: [{ label: "Igen" }, { label: "Nem" }],
      }),
    );
    expect(res.status).toBeLessThan(300);

    const vote = await prisma.vote.findFirst({ where: { buildingId: building.id }, orderBy: { createdAt: "desc" } });
    expect(vote).not.toBeNull();
    expect(vote!.eligibleUnitCount).toBe(3);
    expect(vote!.eligibleUnitsHash).toMatch(/^[a-f0-9]{64}$/);
    expect(vote!.eligibleSnapshotAt).not.toBeNull();
  });

  it("hash reflects the eligible set (differs across buildings with different units)", async () => {
    const a = await makeBuilding();
    const b = await makeBuilding({ name: "B" });
    for (const [bldg, nums] of [[a.building, ["1", "2"]], [b.building, ["1", "2", "3", "4"]]] as const) {
      for (const n of nums) {
        await prisma.unit.create({ data: { number: n, floor: 1, size: 50, ownershipShare: 0.25, buildingId: bldg.id } });
      }
    }
    const adminA = await makeUser({ buildingId: a.building.id, role: "ADMIN" });
    const adminB = await makeUser({ buildingId: b.building.id, role: "ADMIN" });

    ctxMock.mockResolvedValue({ userId: adminA.id, buildingId: a.building.id, role: "ADMIN", isChair: true });
    await POST(req({ title: "A", deadline: new Date(Date.now() + 86400000).toISOString(), options: [{ label: "I" }, { label: "N" }] }));
    ctxMock.mockResolvedValue({ userId: adminB.id, buildingId: b.building.id, role: "ADMIN", isChair: true });
    await POST(req({ title: "B", deadline: new Date(Date.now() + 86400000).toISOString(), options: [{ label: "I" }, { label: "N" }] }));

    const va = await prisma.vote.findFirst({ where: { buildingId: a.building.id } });
    const vb = await prisma.vote.findFirst({ where: { buildingId: b.building.id } });
    expect(va!.eligibleUnitCount).toBe(2);
    expect(vb!.eligibleUnitCount).toBe(4);
    expect(va!.eligibleUnitsHash).not.toBe(vb!.eligibleUnitsHash);
  });
});
