import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Proxy (meghatalmazás) voting: a grantee sees the grantor's unit as votable
 * and casts on its behalf with proxyForUnitId. The grantor's own presence is
 * NOT required (they're represented).
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitMutationOrRespond: vi.fn().mockResolvedValue(null) }));

const { GET: voteGET } = await import("@/app/api/voting/votes/[id]/route");
const { POST: ballotPOST } = await import("@/app/api/voting/votes/[id]/ballot/route");

beforeEach(() => ctxMock.mockReset());

async function scenario() {
  const { building } = await makeBuilding();
  const grantor = await makeUser({ buildingId: building.id, role: "OWNER" });
  const grantee = await makeUser({ buildingId: building.id, role: "OWNER" });
  const grantorUnit = await prisma.unit.create({
    data: { number: "2", floor: 1, ownershipShare: "0.4000", size: "55.00", buildingId: building.id },
  });
  await prisma.unitUser.create({
    data: { userId: grantor.id, unitId: grantorUnit.id, relationship: "OWNER", isPrimaryContact: true },
  });
  // The grantee is also an owner in the building (proxies go to fellow owners).
  const granteeUnit = await prisma.unit.create({
    data: { number: "3", floor: 1, ownershipShare: "0.3000", size: "50.00", buildingId: building.id },
  });
  await prisma.unitUser.create({
    data: { userId: grantee.id, unitId: granteeUnit.id, relationship: "OWNER", isPrimaryContact: true },
  });
  await prisma.proxyAssignment.create({ data: { grantorId: grantor.id, granteeId: grantee.id } });
  const meeting = await prisma.meeting.create({
    data: { title: "Live", date: new Date(), time: "18:00", buildingId: building.id, createdById: grantor.id, liveStatus: "LIVE" },
  });
  const vote = await prisma.vote.create({
    data: {
      buildingId: building.id, title: "V", voteType: "YES_NO", majorityType: "SIMPLE_MAJORITY",
      isSecret: false, status: "OPEN", quorumRequired: 0.5, deadline: new Date("2099-12-31"),
      createdById: grantor.id, meetingId: meeting.id,
    },
  });
  const option = await prisma.voteOption.create({ data: { voteId: vote.id, label: "Igen", sortOrder: 0 } });
  return { building, grantor, grantee, grantorUnit, vote, option };
}

function asGrantee(buildingId: string, userId: string) {
  ctxMock.mockResolvedValue({ userId, buildingId, role: "OWNER", ownsAnyUnit: true, isProfessional: false, isChair: false, isAuditor: false });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("proxy voting", () => {
  it("exposes the grantor's unit to the grantee and casts on its behalf (no presence needed)", async () => {
    const { building, grantee, grantorUnit, vote, option } = await scenario();
    asGrantee(building.id, grantee.id);

    // GET surfaces the proxied unit.
    const detail = await (await voteGET(new NextRequest("http://test/x"), params(vote.id))).json();
    expect(detail.proxyUnits).toHaveLength(1);
    expect(detail.proxyUnits[0].unitId).toBe(grantorUnit.id);
    expect(detail.proxyUnits[0].votedOptionId).toBeNull();

    // Cast on behalf — grantor unit is NOT checked in, but proxy is allowed.
    const res = await ballotPOST(
      new NextRequest("http://test/x", { method: "POST", body: JSON.stringify({ optionId: option.id, proxyForUnitId: grantorUnit.id }) }),
      params(vote.id),
    );
    expect(res.status).toBe(201);

    // GET now shows the proxied unit as voted.
    const after = await (await voteGET(new NextRequest("http://test/x"), params(vote.id))).json();
    expect(after.proxyUnits[0].votedOptionId).toBe(option.id);
  });
});
