import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Pinning a document is metadata, not a content edit — toggling isPinned must
 * NOT bump the document's updatedAt (which would falsely show "modified now"
 * and reorder it by recency).
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/authz", () => ({ allows: vi.fn(() => true), requireCapability: vi.fn() }));
vi.mock("@/lib/documents/events", () => ({ documentPinToggled: vi.fn().mockResolvedValue(undefined) }));

const { POST } = await import("@/app/api/documents/[id]/pin/route");

beforeEach(() => ctxMock.mockReset());

async function makeDoc(buildingId: string, uploaderId: string) {
  const category = await prisma.documentCategory.create({
    data: { name: "Szabályzatok", buildingId, sortOrder: 0 },
  });
  return prisma.document.create({
    data: { title: "Házirend", categoryId: category.id, uploadedById: uploaderId, isPinned: false },
  });
}

function pinReq(pinned: boolean) {
  return new Request("http://localhost/api/documents/x/pin", {
    method: "POST",
    body: JSON.stringify({ pinned }),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/documents/[id]/pin", () => {
  it("toggles isPinned WITHOUT bumping updatedAt", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const doc = await makeDoc(building.id, admin.id);

    // Pin the doc's updatedAt to a fixed past instant so any bump is obvious.
    const past = new Date("2020-01-01T00:00:00.000Z");
    await prisma.$executeRaw`UPDATE "Document" SET "updatedAt" = ${past} WHERE "id" = ${doc.id}`;

    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(pinReq(true), { params: Promise.resolve({ id: doc.id }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: doc.id, isPinned: true });

    const after = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(after!.isPinned).toBe(true);
    // The key assertion: pinning did not touch updatedAt.
    expect(after!.updatedAt.toISOString()).toBe(past.toISOString());
  });

  it("unpins likewise without bumping updatedAt", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const doc = await makeDoc(building.id, admin.id);
    const past = new Date("2020-01-01T00:00:00.000Z");
    await prisma.$executeRaw`UPDATE "Document" SET "isPinned" = true, "updatedAt" = ${past} WHERE "id" = ${doc.id}`;

    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(pinReq(false), { params: Promise.resolve({ id: doc.id }) });
    expect(res.status).toBe(200);

    const after = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(after!.isPinned).toBe(false);
    expect(after!.updatedAt.toISOString()).toBe(past.toISOString());
  });
});
