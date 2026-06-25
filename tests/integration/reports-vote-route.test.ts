import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

const { requireBuildingContextMock } = vi.hoisted(() => ({
  requireBuildingContextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireBuildingContext: requireBuildingContextMock,
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));

// PDF rendering is heavy. We mock the entire report toolchain — the
// route's DB + auth path is what matters for Phase F refactor safety.
vi.mock("@/reports/lib/generate", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("PDF")),
}));
vi.mock("@/reports/lib/fonts", () => ({
  registerReportFonts: vi.fn(),
}));
vi.mock("@/reports/lib/footer", () => ({
  computeReportHash: vi.fn().mockReturnValue("hash-deadbeef"),
}));
vi.mock("@/reports/templates/vote-result", () => ({
  VoteResultPdf: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/voting/quorum", () => ({
  calculateVoteResult: vi.fn().mockResolvedValue({
    passed: true,
    options: [{ id: "o1", label: "Yes", weight: 0.5, votes: 5 }],
  }),
}));

const { GET } = await import("@/app/api/reports/vote/[voteId]/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

async function seedVote(buildingId: string, creatorId: string) {
  return prisma.vote.create({
    data: {
      buildingId,
      title: "Test vote",
      description: "Test description",
      voteType: "YES_NO",
      majorityType: "SIMPLE_MAJORITY",
      isSecret: false,
      status: "OPEN",
      quorumRequired: 0.5,
      deadline: new Date("2026-12-31"),
      createdById: creatorId,
    },
  });
}

describe("GET /api/reports/vote/[voteId]", () => {
  it("returns 404 when the vote belongs to a different building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const creator = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherUser = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const vote = await seedVote(building.id, creator.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: otherUser.id,
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ voteId: vote.id }),
    });
    expect(res.status).toBe(404);
  });

  it("renders the PDF for an in-tenant vote", async () => {
    const { building } = await makeBuilding();
    const creator = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const vote = await seedVote(building.id, creator.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: creator.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ voteId: vote.id }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
  });
});
