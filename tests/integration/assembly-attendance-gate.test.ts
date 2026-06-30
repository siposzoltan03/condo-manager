import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Presence gate: in a live meeting an owner may only cast once their unit is
 * checked in. The companion self-checks-in on joining; here we exercise the
 * server: cast blocked → self check-in → cast allowed.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireBuildingContext: ctxMock,
  getCurrentUser: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitMutationOrRespond: vi.fn().mockResolvedValue(null),
}));

const { POST: ballotPOST } = await import("@/app/api/voting/votes/[id]/ballot/route");
const { POST: checkInPOST } = await import("@/app/api/voting/meetings/[id]/check-in/route");

beforeEach(() => ctxMock.mockReset());

async function liveMeetingWithVote() {
  const { building } = await makeBuilding();
  const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
  const unit = await prisma.unit.create({
    data: { number: "1", floor: 1, ownershipShare: "0.5000", size: "60.00", buildingId: building.id },
  });
  await prisma.unitUser.create({
    data: { userId: owner.id, unitId: unit.id, relationship: "OWNER", isPrimaryContact: true },
  });
  const meeting = await prisma.meeting.create({
    data: { title: "Live", date: new Date(), time: "18:00", buildingId: building.id, createdById: owner.id, liveStatus: "LIVE" },
  });
  const vote = await prisma.vote.create({
    data: {
      buildingId: building.id, title: "V", voteType: "YES_NO", majorityType: "SIMPLE_MAJORITY",
      isSecret: false, status: "OPEN", quorumRequired: 0.5, deadline: new Date("2099-12-31"),
      createdById: owner.id, meetingId: meeting.id,
    },
  });
  const option = await prisma.voteOption.create({ data: { voteId: vote.id, label: "Igen", sortOrder: 0 } });
  return { building, owner, unit, meeting, vote, option };
}

function asOwner(buildingId: string, userId: string) {
  ctxMock.mockResolvedValue({ userId, buildingId, role: "OWNER", ownsAnyUnit: true, isProfessional: false, isChair: false, isAuditor: false });
}

const ballotReq = (optionId: string) =>
  new NextRequest("http://test/x", { method: "POST", body: JSON.stringify({ optionId }) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("assembly presence gate", () => {
  it("blocks a self-cast when the unit is not checked in, allows it after self check-in", async () => {
    const { building, owner, meeting, vote, option } = await liveMeetingWithVote();
    asOwner(building.id, owner.id);

    // Not present yet → blocked.
    const blocked = await ballotPOST(ballotReq(option.id), params(vote.id));
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toBe("NOT_CHECKED_IN");

    // Self check-in.
    const ci = await checkInPOST(new NextRequest("http://test/x", { method: "POST" }), params(meeting.id));
    expect(ci.status).toBe(200);
    expect((await ci.json()).checkedInUnitIds).toHaveLength(1);

    // Now allowed.
    const ok = await ballotPOST(ballotReq(option.id), params(vote.id));
    expect(ok.status).toBe(201);
  });

  it("self check-in is rejected when the meeting is not live", async () => {
    const { building, owner, meeting } = await liveMeetingWithVote();
    await prisma.meeting.update({ where: { id: meeting.id }, data: { liveStatus: "SCHEDULED" } });
    asOwner(building.id, owner.id);
    const res = await checkInPOST(new NextRequest("http://test/x", { method: "POST" }), params(meeting.id));
    expect(res.status).toBe(400);
  });

  it("does not gate a standalone vote (no meeting)", async () => {
    const { building, owner, vote } = await liveMeetingWithVote();
    await prisma.vote.update({ where: { id: vote.id }, data: { meetingId: null } });
    const option = await prisma.voteOption.findFirst({ where: { voteId: vote.id } });
    asOwner(building.id, owner.id);
    const res = await ballotPOST(ballotReq(option!.id), params(vote.id));
    expect(res.status).toBe(201); // no presence gate off-meeting
  });
});
