import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";
import { purgeExpiredUserSessions, sessionCutoff } from "@/lib/retention";

/**
 * Retention purge — stale login sessions. Rows idle past the window are
 * deleted; recent ones are kept. (Ballots/audit logs are intentionally never
 * touched here — legal retention.)
 */
describe("purgeExpiredUserSessions", () => {
  it("deletes sessions idle past the window, keeps recent ones", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "OWNER" });
    const now = new Date("2026-07-03T00:00:00.000Z");

    const stale = await prisma.userSession.create({
      data: { userId: user.id, tokenId: `stale-${user.id}`, lastActiveAt: sessionCutoff(now, 200) },
    });
    const recent = await prisma.userSession.create({
      data: { userId: user.id, tokenId: `recent-${user.id}`, lastActiveAt: sessionCutoff(now, 3) },
    });

    const res = await purgeExpiredUserSessions(prisma, { now, olderThanDays: 90 });
    expect(res.deleted).toBeGreaterThanOrEqual(1);

    expect(await prisma.userSession.findUnique({ where: { id: stale.id } })).toBeNull();
    expect(await prisma.userSession.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it("keeps a session exactly at the boundary is-newer-than cutoff", async () => {
    const { building } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id, role: "OWNER" });
    const now = new Date("2026-07-03T00:00:00.000Z");
    // 89 days old with a 90-day window → kept.
    const s = await prisma.userSession.create({
      data: { userId: user.id, tokenId: `edge-${user.id}`, lastActiveAt: sessionCutoff(now, 89) },
    });
    await purgeExpiredUserSessions(prisma, { now, olderThanDays: 90 });
    expect(await prisma.userSession.findUnique({ where: { id: s.id } })).not.toBeNull();
  });
});
