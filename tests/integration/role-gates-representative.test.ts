import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole } from "@prisma/client";

/**
 * Representative-authority enforcement (Tht. §43): starting a vote requires the
 * CHAIR (BOARD_MEMBER + isChair) or ADMIN — a plain board member is no longer
 * enough. Locks the can()-based gate at the route layer (the create-vote POST
 * checks vote.start before parsing the body, so an empty body suffices).
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

const { POST: createVotePOST } = await import("@/app/api/voting/votes/route");

beforeEach(() => requireBuildingContextMock.mockReset());

function ctxFor(role: BuildingRole, isChair = false) {
  requireBuildingContextMock.mockResolvedValue({
    userId: "u1",
    buildingId: "b1",
    role,
    isChair,
    ownsAnyUnit: false,
    isAuditor: false,
  });
}

const emptyReq = () =>
  new NextRequest("http://test/api/voting/votes", { method: "POST", body: "{}" });

describe("representative authority — create vote (vote.start)", () => {
  it("denies a non-chair BOARD_MEMBER (403)", async () => {
    ctxFor("BOARD_MEMBER", false);
    expect((await createVotePOST(emptyReq())).status).toBe(403);
  });

  it("denies an OWNER (403)", async () => {
    ctxFor("OWNER", false);
    expect((await createVotePOST(emptyReq())).status).toBe(403);
  });

  it("allows the chair (BOARD_MEMBER + isChair) past the gate", async () => {
    ctxFor("BOARD_MEMBER", true);
    expect((await createVotePOST(emptyReq())).status).not.toBe(403);
  });

  it("allows ADMIN past the gate", async () => {
    ctxFor("ADMIN", false);
    expect((await createVotePOST(emptyReq())).status).not.toBe(403);
  });
});
