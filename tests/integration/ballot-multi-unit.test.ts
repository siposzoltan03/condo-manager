import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Multi-unit owners: a single self-cast fans out to one ballot per owned unit
 * (same option), so the full ownership weight counts. Already-voted units are
 * skipped; for a meeting vote only checked-in units are cast.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitMutationOrRespond: vi.fn().mockResolvedValue(null) }));

const { POST: ballotPOST } = await import("@/app/api/voting/votes/[id]/ballot/route");
const { GET: voteGET } = await import("@/app/api/voting/votes/[id]/route");

beforeEach(() => ctxMock.mockReset());

async function ownerWithUnits(shares: string[], opts: { meeting?: boolean } = {}) {
  const { building } = await makeBuilding();
  const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
  const units = [];
  for (let i = 0; i < shares.length; i++) {
    const u = await prisma.unit.create({
      data: { number: `U${i}`, floor: 1, ownershipShare: shares[i], size: "50.00", buildingId: building.id },
    });
    await prisma.unitUser.create({ data: { userId: owner.id, unitId: u.id, relationship: "OWNER", isPrimaryContact: i === 0 } });
    units.push(u);
  }
  const meeting = opts.meeting
    ? await prisma.meeting.create({
        data: { title: "M", date: new Date(), time: "18:00", buildingId: building.id, createdById: owner.id, liveStatus: "LIVE" },
      })
    : null;
  const vote = await prisma.vote.create({
    data: {
      buildingId: building.id, title: "V", voteType: "YES_NO", majorityType: "SIMPLE_MAJORITY",
      isSecret: false, status: "OPEN", quorumRequired: 0.5, deadline: new Date("2099-12-31"),
      createdById: owner.id, meetingId: meeting?.id ?? null,
    },
  });
  const option = await prisma.voteOption.create({ data: { voteId: vote.id, label: "Igen", sortOrder: 0 } });
  return { building, owner, units, meeting, vote, option };
}

function asOwner(buildingId: string, userId: string) {
  ctxMock.mockResolvedValue({ userId, buildingId, role: "OWNER", ownsAnyUnit: true, isProfessional: false, isChair: false, isAuditor: false });
}
const castReq = (optionId: string) => new NextRequest("http://test/x", { method: "POST", body: JSON.stringify({ optionId }) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("multi-unit self-cast fan-out", () => {
  it("casts one ballot per owned unit and sums the weight", async () => {
    const { building, owner, units, vote, option } = await ownerWithUnits(["0.3000", "0.2000"]);
    asOwner(building.id, owner.id);

    const res = await ballotPOST(castReq(option.id), params(vote.id));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.count).toBe(2);

    const ballots = await prisma.ballot.findMany({ where: { voteId: vote.id } });
    expect(ballots).toHaveLength(2);
    expect(new Set(ballots.map((b) => b.unitId))).toEqual(new Set(units.map((u) => u.id)));
    expect(ballots.every((b) => b.optionId === option.id)).toBe(true);

    // GET reflects the summed weight.
    const detail = await (await voteGET(new NextRequest("http://test/x"), params(vote.id))).json();
    expect(detail.myWeight).toBeCloseTo(0.5, 5);
    expect(detail.myBallot?.optionId).toBe(option.id);
  });

  it("skips units that already voted (idempotent re-cast)", async () => {
    const { building, owner, units, vote, option } = await ownerWithUnits(["0.3000", "0.2000"]);
    // One unit already has a ballot.
    await prisma.ballot.create({ data: { voteId: vote.id, optionId: option.id, unitId: units[0].id, userId: owner.id, weight: "0.3000" } });
    asOwner(building.id, owner.id);

    const res = await ballotPOST(castReq(option.id), params(vote.id));
    expect(res.status).toBe(201);
    expect((await res.json()).count).toBe(1); // only the second unit
    expect(await prisma.ballot.count({ where: { voteId: vote.id } })).toBe(2);
  });

  it("in a meeting, casts only for checked-in units", async () => {
    const { building, owner, units, meeting, vote, option } = await ownerWithUnits(["0.3000", "0.2000"], { meeting: true });
    // Only the first unit is checked in.
    await prisma.meetingAttendance.create({ data: { meetingId: meeting!.id, unitId: units[0].id, checkedIn: true } });
    asOwner(building.id, owner.id);

    const res = await ballotPOST(castReq(option.id), params(vote.id));
    expect(res.status).toBe(201);
    expect((await res.json()).count).toBe(1);
    const ballots = await prisma.ballot.findMany({ where: { voteId: vote.id } });
    expect(ballots.map((b) => b.unitId)).toEqual([units[0].id]);
  });
});
