import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Ownership shares (tulajdoni hányad) are legal-register data from the alapító
 * okirat. They may only change via the audited amend-founding-deed endpoint
 * (with an attestation), never through a casual unit edit.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/frozen-check", () => ({
  requireNotFrozen: vi.fn().mockResolvedValue(undefined),
  FrozenBuildingError: class extends Error {},
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

// Real authz + capabilities (we want to exercise the foundingDeed.amend gate).
const { createAuditLog } = await import("@/lib/audit");
const { POST } = await import("@/app/api/documents/[id]/amend-shares/route");
const { updateUnit } = await import("@/app/actions/units");

beforeEach(() => {
  ctxMock.mockReset();
  vi.mocked(createAuditLog).mockClear();
});

/** Founding-deed document + one version + two 50% units in a fresh building. */
async function setup(kind: "FOUNDING_DEED" | "SZMSZ" = "FOUNDING_DEED") {
  const { building } = await makeBuilding();
  const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
  const category = await prisma.documentCategory.create({
    data: { name: "Alapító okirat", buildingId: building.id, sortOrder: 0 },
  });
  const doc = await prisma.document.create({
    data: {
      title: "Alapító okirat",
      categoryId: category.id,
      kind,
      uploadedById: admin.id,
      versions: {
        create: {
          versionNumber: 1,
          fileUrl: "/api/files/deed-v1",
          fileName: "deed.pdf",
          fileSize: 1,
          mimeType: "application/pdf",
          uploadedById: admin.id,
        },
      },
    },
    include: { versions: true },
  });
  const u1 = await prisma.unit.create({
    data: { number: "1", floor: 1, size: 50, ownershipShare: 0.5, buildingId: building.id },
  });
  const u2 = await prisma.unit.create({
    data: { number: "2", floor: 2, size: 50, ownershipShare: 0.5, buildingId: building.id },
  });
  return { building, admin, doc, versionId: doc.versions[0].id, u1, u2 };
}

function req(body: unknown) {
  return new Request("http://localhost/api/documents/x/amend-shares", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/documents/[id]/amend-shares", () => {
  it("applies new shares, stamps provenance, and audits (ADMIN)", async () => {
    const { building, admin, doc, versionId } = await setup();
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });

    const res = await POST(
      req({
        versionId,
        units: [
          { number: "1", ownershipShare: 0.6 },
          { number: "2", ownershipShare: 0.4 },
        ],
        attestation: { reference: "Dr. Kiss ügyvéd, 2026-06-30, okirat 12/2026" },
      }),
      { params: Promise.resolve({ id: doc.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, changed: 2 });

    const units = await prisma.unit.findMany({ where: { buildingId: building.id }, orderBy: { number: "asc" } });
    expect(Number(units[0].ownershipShare)).toBeCloseTo(0.6, 4);
    expect(Number(units[1].ownershipShare)).toBeCloseTo(0.4, 4);
    // Provenance points at the founding-deed version.
    expect(units[0].ownershipShareSourceVersionId).toBe(versionId);
    expect(units[1].ownershipShareSourceVersionId).toBe(versionId);
    // The amendment is audited with the attestation reference.
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    const audit = vi.mocked(createAuditLog).mock.calls[0][0];
    expect(audit.newValue).toMatchObject({ attestationReference: "Dr. Kiss ügyvéd, 2026-06-30, okirat 12/2026" });
  });

  it("rejects a non-ADMIN (foundingDeed.amend denied → 403)", async () => {
    const { building, doc, versionId } = await setup();
    const board = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    ctxMock.mockResolvedValue({ userId: board.id, buildingId: building.id, role: "BOARD_MEMBER" });

    const res = await POST(
      req({ versionId, units: [{ number: "1", ownershipShare: 0.6 }, { number: "2", ownershipShare: 0.4 }], attestation: { reference: "x" } }),
      { params: Promise.resolve({ id: doc.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("requires an attestation reference", async () => {
    const { building, admin, doc, versionId } = await setup();
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(
      req({ versionId, units: [{ number: "1", ownershipShare: 0.6 }, { number: "2", ownershipShare: 0.4 }], attestation: { reference: "  " } }),
      { params: Promise.resolve({ id: doc.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects when shares don't sum to 100%", async () => {
    const { building, admin, doc, versionId } = await setup();
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(
      req({ versionId, units: [{ number: "1", ownershipShare: 0.6 }, { number: "2", ownershipShare: 0.5 }], attestation: { reference: "x" } }),
      { params: Promise.resolve({ id: doc.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects amending from a non-founding-deed document (SZMSZ)", async () => {
    const { building, admin, doc, versionId } = await setup("SZMSZ");
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await POST(
      req({ versionId, units: [{ number: "1", ownershipShare: 0.6 }, { number: "2", ownershipShare: 0.4 }], attestation: { reference: "x" } }),
      { params: Promise.resolve({ id: doc.id }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("updateUnit gate", () => {
  it("blocks changing ownershipShare through the casual unit edit", async () => {
    const { building, admin, u1 } = await setup();
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await updateUnit(u1.id, { ownershipShare: 0.7 });
    expect(res.error).toBeTruthy();
    const after = await prisma.unit.findUnique({ where: { id: u1.id } });
    expect(Number(after!.ownershipShare)).toBeCloseTo(0.5, 4); // unchanged
  });

  it("still allows editing other unit fields (no share change)", async () => {
    const { building, admin, u1 } = await setup();
    ctxMock.mockResolvedValue({ userId: admin.id, buildingId: building.id, role: "ADMIN" });
    const res = await updateUnit(u1.id, { floor: 3, ownershipShare: 0.5 });
    expect(res.success).toBe(true);
    const after = await prisma.unit.findUnique({ where: { id: u1.id } });
    expect(after!.floor).toBe(3);
  });
});
