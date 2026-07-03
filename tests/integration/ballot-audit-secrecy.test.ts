import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";
import { ballotCast } from "@/lib/voting/events";

/**
 * Secret-ballot secrecy in the process audit: a cast on a SECRET vote must
 * record only participation (turnout) — never anything that ties the voter to
 * a unit, a specific ballot row, or the chosen option. Otherwise the audit
 * trail (which carries the caster's userId) could be joined back to the ballot
 * and reveal how they voted.
 */
describe("ballotCast audit — secret-ballot secrecy", () => {
  it("SECRET vote: records only turnout (Vote entity, count, no unit/ballot link)", async () => {
    const { building } = await makeBuilding();
    const voter = await makeUser({ buildingId: building.id, role: "OWNER" });

    const castAt = new Date(Math.floor(Date.now() / 60000) * 60000); // minute-quantised
    await ballotCast({
      voteId: "vote-secret-1",
      ballotId: "ballot-should-not-be-referenced",
      voterUserId: voter.id,
      buildingId: building.id,
      isSecret: true,
      unitIds: ["unit-a", "unit-b"],
      isProxy: false,
      isOnBehalf: false,
      castAt,
    });

    const row = await prisma.auditLog.findFirst({
      where: { buildingId: building.id, userId: voter.id, entityType: "Vote" },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    // Turnout timestamp is minute-quantised (no seconds) to prevent
    // time-correlation with a specific ballot row.
    expect(row!.createdAt.getTime()).toBe(castAt.getTime());
    expect(row!.createdAt.getSeconds()).toBe(0);
    expect(row!.createdAt.getMilliseconds()).toBe(0);
    // Never points at a specific (secret) ballot row.
    expect(row!.entityType).toBe("Vote");
    expect(row!.entityId).toBe("vote-secret-1");
    const nv = row!.newValue as Record<string, unknown>;
    // Turnout only.
    expect(nv).toMatchObject({ voteId: "vote-secret-1", isSecret: true, count: 2 });
    // The leak that must NOT be present:
    const serialized = JSON.stringify(nv);
    expect(nv).not.toHaveProperty("unitIds");
    expect(serialized).not.toContain("unit-a");
    expect(serialized).not.toContain("unit-b");
    expect(serialized).not.toContain("ballot-should-not-be-referenced");
  });

  it("OPEN vote: records per-unit detail (Ballot entity, unitIds present)", async () => {
    const { building } = await makeBuilding();
    const voter = await makeUser({ buildingId: building.id, role: "OWNER" });

    await ballotCast({
      voteId: "vote-open-1",
      ballotId: "ballot-open-1",
      voterUserId: voter.id,
      buildingId: building.id,
      isSecret: false,
      unitIds: ["unit-x"],
      isProxy: false,
      isOnBehalf: false,
    });

    const row = await prisma.auditLog.findFirst({
      where: { buildingId: building.id, userId: voter.id, entityType: "Ballot" },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    expect(row!.entityId).toBe("ballot-open-1");
    const nv = row!.newValue as Record<string, unknown>;
    expect(nv).toMatchObject({ voteId: "vote-open-1", isSecret: false });
    expect(nv.unitIds).toEqual(["unit-x"]);
  });
});
