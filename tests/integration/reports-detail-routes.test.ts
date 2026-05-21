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

const { GET: statusGET } = await import("@/app/api/reports/[id]/status/route");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

async function seedReport(opts: {
  buildingId: string;
  generatedById: string;
  status?: "PENDING" | "READY" | "FAILED";
}) {
  return prisma.generatedReport.create({
    data: {
      buildingId: opts.buildingId,
      kind: "meeting-summary",
      period: "meeting-x",
      contentHash: "hash-" + Math.random().toString(36).slice(2),
      status: opts.status ?? "PENDING",
      generatedById: opts.generatedById,
    },
  });
}

describe("GET /api/reports/[id]/status", () => {
  it("returns the report status in the right building", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });
    const report = await seedReport({
      buildingId: building.id,
      generatedById: user.id,
      status: "PENDING",
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: user.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await statusGET(new Request("http://test") as never, {
      params: Promise.resolve({ id: report.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
  });

  it("returns 404 for cross-tenant lookup", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });
    const otherUser = await makeUser({ buildingId: otherBuilding.id });
    const report = await seedReport({
      buildingId: building.id,
      generatedById: user.id,
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: otherUser.id,
      buildingId: otherBuilding.id,
      role: "RESIDENT",
    });

    const res = await statusGET(new Request("http://test") as never, {
      params: Promise.resolve({ id: report.id }),
    });
    expect(res.status).toBe(404);
  });
});
