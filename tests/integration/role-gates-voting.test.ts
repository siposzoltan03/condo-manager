import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * vote.cast gate (Tht. §38 — owners only). Regression for the bug where the
 * ballot self-cast path accepted ANY unit member: now it requires
 * can(actor, "vote.cast") (ownsAnyUnit) before a self-cast.
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
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitMutationOrRespond: vi.fn().mockResolvedValue(null),
}));

const { POST: ballotPOST } = await import(
  "@/app/api/voting/votes/[id]/ballot/route"
);

beforeEach(() => requireBuildingContextMock.mockReset());

async function openVote() {
  const { building } = await makeBuilding();
  const creator = await makeUser({
    buildingId: building.id,
    role: "BOARD_MEMBER",
  });
  const vote = await prisma.vote.create({
    data: {
      buildingId: building.id,
      title: "Test vote",
      description: "d",
      voteType: "YES_NO",
      majorityType: "SIMPLE_MAJORITY",
      isSecret: false,
      status: "OPEN",
      quorumRequired: 0.5,
      deadline: new Date("2099-12-31"),
      createdById: creator.id,
    },
  });
  const option = await prisma.voteOption.create({
    data: { voteId: vote.id, label: "Yes" },
  });
  return { building, vote, option };
}

function castReq(optionId: string) {
  return new NextRequest("http://test/api/voting/votes/x/ballot", {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}

describe("POST ballot — vote.cast (owners only, Tht. §38)", () => {
  it("TENANT cannot self-cast (403)", async () => {
    const { building, vote, option } = await openVote();
    const tenant = await makeUser({ buildingId: building.id, role: "TENANT" });
    requireBuildingContextMock.mockResolvedValue({
      userId: tenant.id,
      buildingId: building.id,
      role: "TENANT",
      ownsAnyUnit: false,
    });
    const res = await ballotPOST(castReq(option.id), {
      params: Promise.resolve({ id: vote.id }),
    });
    expect(res.status).toBe(403);
  });

  it("OWNER passes the vote.cast gate (not 403)", async () => {
    const { building, vote, option } = await openVote();
    const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
    requireBuildingContextMock.mockResolvedValue({
      userId: owner.id,
      buildingId: building.id,
      role: "OWNER",
      ownsAnyUnit: true,
    });
    // No owned unit row seeded → the gate passes, then the unit lookup 400s.
    // A 403 would mean the gate wrongly blocked an owner.
    const res = await ballotPOST(castReq(option.id), {
      params: Promise.resolve({ id: vote.id }),
    });
    expect(res.status).not.toBe(403);
  });
});
