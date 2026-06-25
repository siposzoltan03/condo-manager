import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
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

vi.mock("@/lib/frozen-check", () => ({
  requireNotFrozen: vi.fn().mockResolvedValue(undefined),
  FrozenBuildingError: class FrozenBuildingError extends Error {},
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitMutationOrRespond: vi.fn().mockResolvedValue(null),
}));

const { GET, POST } = await import("@/app/api/complaints/route");

async function seedCategory(buildingId: string, slug = "noise") {
  return prisma.complaintCategory.create({
    data: {
      buildingId,
      name: "Noise",
      slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      icon: "🔊",
    },
  });
}

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

describe("GET /api/complaints", () => {
  it("board sees all in-building complaints (private + public)", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const board = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const cat = await seedCategory(building.id);
    await prisma.complaint.create({
      data: {
        authorId: author.id,
        buildingId: building.id,
        categoryId: cat.id,
        description: "Loud A",
        isPrivate: true,
        trackingNumber: "CMP-A-001",
      },
    });
    await prisma.complaint.create({
      data: {
        authorId: author.id,
        buildingId: building.id,
        categoryId: cat.id,
        description: "Public B",
        isPrivate: false,
        trackingNumber: "CMP-A-002",
      },
    });
    // Other building complaint — must not leak.
    const otherAuthor = await makeUser({ buildingId: otherBuilding.id });
    const otherCat = await seedCategory(otherBuilding.id);
    await prisma.complaint.create({
      data: {
        authorId: otherAuthor.id,
        buildingId: otherBuilding.id,
        categoryId: otherCat.id,
        description: "Other building",
        isPrivate: false,
        trackingNumber: "CMP-O-001",
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: board.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await GET(new NextRequest("http://test/api/complaints"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.complaints.every((c: { id: string }) => c.id)).toBe(true);
  });

  it("non-board user sees only public complaints + their own", async () => {
    const { building } = await makeBuilding();
    const author = await makeUser({ buildingId: building.id });
    const otherResident = await makeUser({ buildingId: building.id });
    const cat = await seedCategory(building.id);
    await prisma.complaint.create({
      data: {
        authorId: author.id,
        buildingId: building.id,
        categoryId: cat.id,
        description: "Mine — private",
        isPrivate: true,
        trackingNumber: "CMP-A-001",
      },
    });
    await prisma.complaint.create({
      data: {
        authorId: author.id,
        buildingId: building.id,
        categoryId: cat.id,
        description: "Mine — public",
        isPrivate: false,
        trackingNumber: "CMP-A-002",
      },
    });
    await prisma.complaint.create({
      data: {
        authorId: otherResident.id,
        buildingId: building.id,
        categoryId: cat.id,
        description: "Their private — hidden",
        isPrivate: true,
        trackingNumber: "CMP-A-003",
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: author.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const res = await GET(new NextRequest("http://test/api/complaints"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Author sees: their private + their public + (other's private hidden)
    expect(body.total).toBe(2);
  });
});

describe("POST /api/complaints", () => {
  it("creates a complaint with a tracking number and writes an audit log", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });
    const cat = await seedCategory(building.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: user.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const req = new NextRequest("http://test/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        description: "Test complaint body",
        isPrivate: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.trackingNumber).toMatch(/^CMP-\d{4}-\d{3}$/);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "Complaint", entityId: body.id },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects with 400 when the category belongs to a different building", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });
    const otherCat = await seedCategory(otherBuilding.id);

    requireBuildingContextMock.mockResolvedValue({
      userId: user.id,
      buildingId: building.id,
      role: "RESIDENT",
    });

    const req = new NextRequest("http://test/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        categoryId: otherCat.id,
        description: "Trying to cross tenants",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const created = await prisma.complaint.count({});
    expect(created).toBe(0);
  });
});
