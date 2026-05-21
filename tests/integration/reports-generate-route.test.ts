import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

const { requireBuildingContextMock, queueAddMock } = vi.hoisted(() => ({
  requireBuildingContextMock: vi.fn(),
  queueAddMock: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/lib/queue", () => ({
  reportsQueue: { add: queueAddMock },
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) },
  scheduledQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/reports/version-hash", () => ({
  computeVoteResultHash: vi.fn().mockResolvedValue("hash-vote-1"),
  computeMeetingSummaryHash: vi.fn().mockResolvedValue("hash-meeting-1"),
  computeMinutesHash: vi.fn().mockResolvedValue("hash-minutes-1"),
  computeFinanceSummaryHash: vi.fn().mockResolvedValue("hash-fin-1"),
  computeYearEndAccountHash: vi.fn().mockResolvedValue("hash-year-1"),
  computeUtilityStatementHash: vi.fn().mockResolvedValue("hash-util-1"),
  computeAuditSliceHash: vi.fn().mockResolvedValue("hash-audit-1"),
}));

const { POST } = await import("@/app/api/reports/generate/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
  queueAddMock.mockClear();
});

async function seedVote(buildingId: string, creatorId: string) {
  return prisma.vote.create({
    data: {
      buildingId,
      title: "Test vote",
      voteType: "YES_NO",
      majorityType: "SIMPLE_MAJORITY",
      status: "OPEN",
      quorumRequired: 0.5,
      deadline: new Date("2026-12-31"),
      createdById: creatorId,
    },
  });
}

describe("POST /api/reports/generate", () => {
  it("creates a fresh GeneratedReport + enqueues a job (vote-result)", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const vote = await seedVote(building.id, board.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/reports/generate", {
      method: "POST",
      body: JSON.stringify({ kind: "vote-result", refId: vote.id }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PENDING");

    const report = await prisma.generatedReport.findUnique({
      where: { id: body.reportId },
    });
    expect(report).not.toBeNull();
    expect(report!.kind).toBe("vote-result");
    expect(queueAddMock).toHaveBeenCalledWith("vote-result", {
      reportId: body.reportId,
    });
  });

  it("dedupes: same kind + refId + hash returns existing row without re-enqueueing", async () => {
    const { building } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const vote = await seedVote(building.id, board.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    // First call — creates the row.
    const first = await POST(
      new NextRequest("http://test/api/reports/generate", {
        method: "POST",
        body: JSON.stringify({ kind: "vote-result", refId: vote.id }),
        headers: { "content-type": "application/json" },
      }),
    );
    const firstBody = await first.json();
    // Mark it READY so the dedupe branch returns instead of resetting.
    await prisma.generatedReport.update({
      where: { id: firstBody.reportId },
      data: { status: "READY", finishedAt: new Date(), fileSize: 100 },
    });
    queueAddMock.mockClear();

    // Second call — should NOT enqueue, should return same id.
    const second = await POST(
      new NextRequest("http://test/api/reports/generate", {
        method: "POST",
        body: JSON.stringify({ kind: "vote-result", refId: vote.id }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.reportId).toBe(firstBody.reportId);
    expect(secondBody.status).toBe("READY");
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a cross-tenant vote refId", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const otherBoard = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const otherVote = await seedVote(otherBuilding.id, otherBoard.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new NextRequest("http://test/api/reports/generate", {
      method: "POST",
      body: JSON.stringify({ kind: "vote-result", refId: otherVote.id }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
