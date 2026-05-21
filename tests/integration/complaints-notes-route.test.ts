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

vi.mock("@/lib/queue", () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) },
  scheduledQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

const { GET, POST } = await import("@/app/api/complaints/[id]/notes/route");

async function seedComplaintWithCategory(buildingId: string, authorId: string) {
  const category = await prisma.complaintCategory.create({
    data: { buildingId, name: "Noise", slug: "noise", icon: "🔊" },
  });
  return prisma.complaint.create({
    data: {
      authorId,
      buildingId,
      categoryId: category.id,
      description: "Loud",
      isPrivate: true,
      trackingNumber: `C-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("GET /api/complaints/[id]/notes", () => {
  it("board sees internal + non-internal notes; resident sees only non-internal", async () => {
    const { building } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const complaint = await seedComplaintWithCategory(building.id, author.id);

    await prisma.complaintNote.create({
      data: {
        complaintId: complaint.id,
        authorId: board.id,
        body: "Public note",
        isInternal: false,
      },
    });
    await prisma.complaintNote.create({
      data: {
        complaintId: complaint.id,
        authorId: board.id,
        body: "Internal board note",
        isInternal: true,
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const boardRes = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ id: complaint.id }),
    });
    expect(boardRes.status).toBe(200);
    const boardBody = await boardRes.json();
    expect(boardBody.notes).toHaveLength(2);

    requireBuildingContextMock.mockResolvedValue({
      userId: author.id,
      buildingId: building.id,
      role: "RESIDENT",
    });
    const authorRes = await GET(new Request("http://test") as never, {
      params: Promise.resolve({ id: complaint.id }),
    });
    expect(authorRes.status).toBe(200);
    const authorBody = await authorRes.json();
    expect(authorBody.notes).toHaveLength(1);
    expect(authorBody.notes[0].body).toBe("Public note");
  });
});

describe("POST /api/complaints/[id]/notes", () => {
  it("board posts a note and the complaint author gets notified", async () => {
    const { building } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const complaint = await seedComplaintWithCategory(building.id, author.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const req = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ body: "Looking into this", isInternal: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ id: complaint.id }),
    });
    expect(res.status).toBe(201);

    const notif = await prisma.notification.findFirst({
      where: { userId: author.id, type: "COMPLAINT_STATUS" },
    });
    expect(notif).not.toBeNull();
  });

  it("returns 404 when a board user in the other building tries to read", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const otherBoard = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const complaint = await seedComplaintWithCategory(building.id, author.id);

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
