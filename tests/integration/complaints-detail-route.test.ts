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

const { GET } = await import("@/app/api/complaints/[id]/route");

async function seedComplaint(opts: {
  buildingId: string;
  authorId: string;
  isPrivate: boolean;
}) {
  const category = await prisma.complaintCategory.create({
    data: {
      buildingId: opts.buildingId,
      name: "Noise",
      slug: "noise",
      icon: "🔊",
    },
  });
  return prisma.complaint.create({
    data: {
      authorId: opts.authorId,
      buildingId: opts.buildingId,
      categoryId: category.id,
      description: "Loud neighbor",
      isPrivate: opts.isPrivate,
      trackingNumber: `C-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("GET /api/complaints/[id]", () => {
  it("returns the complaint to a BOARD_MEMBER in the right building", async () => {
    const { building } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const complaint = await seedComplaint({
      buildingId: building.id,
      authorId: author.id,
      isPrivate: true,
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ id: complaint.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(complaint.id);
  });

  it("hides private complaints from non-board users who are not the author", async () => {
    const { building } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const otherResident = await makeUser({ buildingId: building.id });
    const complaint = await seedComplaint({
      buildingId: building.id,
      authorId: author.id,
      isPrivate: true,
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: otherResident.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ id: complaint.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant access (board in other building)", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const otherBoard = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const complaint = await seedComplaint({
      buildingId: building.id,
      authorId: author.id,
      isPrivate: false,
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: otherBoard.id,
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ id: complaint.id }),
    });
    expect(res.status).toBe(404);
  });
});
