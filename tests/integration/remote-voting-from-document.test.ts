import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Recording remote-voting authorisation from an uploaded SZMSZ / alapító okirat
 * document (the clause detected by the LLM, confirmed by a human). Evidence-
 * based: references the actual document + version. ADMIN-gated (bylaws.modify).
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/frozen-check", () => ({
  requireNotFrozen: vi.fn().mockResolvedValue(undefined),
  FrozenBuildingError: class extends Error {},
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { POST } = await import("@/app/api/buildings/remote-voting/from-document/route");

beforeEach(() => ctxMock.mockReset());

async function szmszDoc(buildingId: string, uploaderId: string, kind: "SZMSZ" | "HOUSE_RULES" = "SZMSZ") {
  const category = await prisma.documentCategory.create({
    data: { name: "SZMSZ", buildingId, sortOrder: 0 },
  });
  const doc = await prisma.document.create({
    data: {
      title: "SZMSZ", categoryId: category.id, kind, uploadedById: uploaderId,
      versions: {
        create: {
          versionNumber: 2, fileUrl: "/api/files/szmsz-v2", fileName: "szmsz.pdf",
          fileSize: 1, mimeType: "application/pdf", uploadedById: uploaderId,
        },
      },
    },
    include: { versions: true },
  });
  return { doc, versionId: doc.versions[0].id };
}

function req(body: unknown) {
  return new Request("http://localhost/api/buildings/remote-voting/from-document", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/buildings/remote-voting/from-document", () => {
  it("ADMIN records authorisation referencing the SZMSZ document + version + section", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const { doc, versionId } = await szmszDoc(building.id, admin.id);
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });

    const res = await POST(req({ documentId: doc.id, versionId, section: "12. § (3)" }));
    expect(res.status).toBe(200);
    const b = await prisma.building.findUnique({ where: { id: building.id } });
    expect(b!.remoteVotingAuthorized).toBe(true);
    expect(b!.remoteVotingSzmszRef).toBe("SZMSZ v2 · 12. § (3)");
  });

  it("rejects a non-ADMIN (403)", async () => {
    const { building } = await makeBuilding();
    const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const { doc, versionId } = await szmszDoc(building.id, admin.id);
    ctxMock.mockResolvedValue({ userId: owner.id, buildingId: building.id, role: "OWNER" });
    const res = await POST(req({ documentId: doc.id, versionId }));
    expect(res.status).toBe(403);
  });

  it("rejects a non-SZMSZ document kind (400)", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const { doc, versionId } = await szmszDoc(building.id, admin.id, "HOUSE_RULES");
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(req({ documentId: doc.id, versionId }));
    expect(res.status).toBe(400);
    const b = await prisma.building.findUnique({ where: { id: building.id } });
    expect(b!.remoteVotingAuthorized).toBe(false);
  });

  it("rejects a version that doesn't belong to the document (400)", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const { doc } = await szmszDoc(building.id, admin.id);
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(req({ documentId: doc.id, versionId: "does-not-exist" }));
    expect(res.status).toBe(400);
  });
});
