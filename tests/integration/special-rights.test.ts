import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";
import { recordSpecialRightsFromVersion, listSpecialRights } from "@/lib/special-rights";
import type { ExtractedSpecialRight } from "@/lib/legal-doc-extract";

async function makeDeedVersion(buildingId: string, uploaderId: string) {
  const category = await prisma.documentCategory.create({
    data: { buildingId, name: `Legal ${buildingId}` },
  });
  const doc = await prisma.document.create({
    data: { categoryId: category.id, title: "Alapító okirat", kind: "FOUNDING_DEED", uploadedById: uploaderId },
  });
  const version = await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      versionNumber: 1,
      fileUrl: "s3://x",
      fileName: "deed.pdf",
      fileSize: 1,
      mimeType: "application/pdf",
      uploadedById: uploaderId,
    },
  });
  return { doc, version };
}

describe("recordSpecialRightsFromVersion", () => {
  it("records rights, maps unit numbers, is idempotent on re-record, audits", async () => {
    const { building } = await makeBuilding();
    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const unit = await prisma.unit.create({
      data: { buildingId: building.id, number: "P-12", floor: 0, ownershipShare: 0.01, size: 12 },
    });
    const { version } = await makeDeedVersion(building.id, admin.id);

    const rights: ExtractedSpecialRight[] = [
      { kind: "PARKING", description: "Parkoló P-12", unitNumber: "p-12", location: "P-12", areaSize: 12, section: "5. §" },
      { kind: "PRE_EMPTION", description: "Elővásárlási jog", unitNumber: null, location: null, areaSize: null, section: "7. §" },
    ];

    const res = await recordSpecialRightsFromVersion(prisma, {
      buildingId: building.id,
      versionId: version.id,
      actorId: admin.id,
      rights,
    });
    expect(res.recorded).toBe(2);

    const listed = await listSpecialRights(prisma, building.id);
    expect(listed).toHaveLength(2);
    const parking = listed.find((r) => r.kind === "PARKING");
    // Unit number resolved (case-insensitive) to the unit id.
    expect(parking?.unit?.id).toBe(unit.id);
    expect(parking?.sourceVersionId).toBe(version.id);
    const preemption = listed.find((r) => r.kind === "PRE_EMPTION");
    expect(preemption?.unit).toBeNull();

    // Audit row written.
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "Building", entityId: building.id, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect((log?.newValue as { specialRightsRecorded?: number })?.specialRightsRecorded).toBe(2);

    // Re-record with a single right → replaces the prior two (idempotent).
    const res2 = await recordSpecialRightsFromVersion(prisma, {
      buildingId: building.id,
      versionId: version.id,
      actorId: admin.id,
      rights: [{ kind: "STORAGE", description: "Tároló", unitNumber: null, location: "T-3", areaSize: 4, section: "9. §" }],
    });
    expect(res2.recorded).toBe(1);
    const relisted = await listSpecialRights(prisma, building.id);
    expect(relisted).toHaveLength(1);
    expect(relisted[0].kind).toBe("STORAGE");
  });
});
