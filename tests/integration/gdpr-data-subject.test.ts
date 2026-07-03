import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";
import {
  anonymizeUser,
  buildUserDataExport,
  ANONYMIZED_NAME,
  anonymizedEmail,
} from "@/lib/gdpr";

/**
 * GDPR data-subject rights. Art. 15 export returns the caller's personal data
 * (never security material); Art. 17 anonymisation nulls PII + revokes
 * sessions while leaving statutory-retention rows intact.
 */
describe("anonymizeUser (Art. 17 erasure)", () => {
  it("nulls PII, sets tombstone, revokes sessions, deactivates membership, audits", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({
      buildingId: building.id,
      role: "OWNER",
      email: `erase-${Date.now()}@test.local`,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: "+36301234567", permanentAddress: "Fő utca 1", totpSecret: "SECRET" },
    });
    const session = await prisma.userSession.create({
      data: { userId: user.id, tokenId: `tok-${user.id}` },
    });

    const admin = await makeUser({ buildingId: building.id, role: "ADMIN" });

    await anonymizeUser(prisma, user.id, { actorId: admin.id, buildingId: building.id });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.name).toBe(ANONYMIZED_NAME);
    expect(after.email).toBe(anonymizedEmail(user.id));
    expect(after.phone).toBeNull();
    expect(after.permanentAddress).toBeNull();
    expect(after.totpSecret).toBeNull();
    expect(after.isActive).toBe(false);
    expect(after.deletedAt).not.toBeNull();
    expect(after.anonymizedAt).not.toBeNull();

    // Session revoked.
    expect(await prisma.userSession.findUnique({ where: { id: session.id } })).toBeNull();

    // Membership deactivated.
    const mem = await prisma.userBuilding.findFirstOrThrow({ where: { userId: user.id } });
    expect(mem.isActive).toBe(false);

    // Audit row written by the admin actor.
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "User", entityId: user.id, action: "DELETE" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.userId).toBe(admin.id);
    expect((log?.newValue as { anonymized?: boolean })?.anonymized).toBe(true);
  });
});

describe("buildUserDataExport (Art. 15 access)", () => {
  it("returns the caller's profile but never security material", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({
      buildingId: building.id,
      role: "OWNER",
      email: `export-${Date.now()}@test.local`,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: "+36301112222", totpSecret: "SECRET" },
    });

    const payload = (await buildUserDataExport(prisma, user.id)) as Record<string, unknown>;
    expect(payload).not.toBeNull();
    expect(payload.gdprArticle).toBe("Article 15");

    const profile = payload.profile as Record<string, unknown>;
    expect(profile.email).toContain("@test.local");
    expect(profile.phone).toBe("+36301112222");
    // Security material must never appear in the export.
    expect(profile.passwordHash).toBeUndefined();
    expect(profile.totpSecret).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("SECRET");

    // Membership is included.
    const memberships = payload.memberships as unknown[];
    expect(memberships.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null for an unknown user", async () => {
    expect(await buildUserDataExport(prisma, "does-not-exist")).toBeNull();
  });
});
