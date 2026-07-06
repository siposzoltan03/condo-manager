import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";
import { sealMinutes, verifyLatestMinutes } from "@/lib/voting/minutes-integrity";

async function makeMeeting(buildingId: string, createdById: string, minutes: string) {
  return prisma.meeting.create({
    data: {
      buildingId,
      createdById,
      title: "Rendes közgyűlés",
      date: new Date("2026-06-01T17:00:00.000Z"),
      time: "17:00",
      minutes,
    },
  });
}

describe("minutes integrity (content-hash + sealing)", () => {
  it("seals v1, detects tampering, re-seals as v2, and no-ops on unchanged content", async () => {
    const { building } = await makeBuilding();
    const chair = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const meeting = await makeMeeting(building.id, chair.id, "A közgyűlés a napirendet elfogadta.");

    // Seal v1.
    const v1 = await sealMinutes(prisma, { meetingId: meeting.id, sealedById: chair.id });
    expect(v1.versionNumber).toBe(1);
    expect(v1.alreadySealed).toBe(false);
    expect(v1.contentHash).toHaveLength(64);

    // Verify: still matches.
    let status = await verifyLatestMinutes(prisma, meeting.id);
    expect(status.sealed).toBe(true);
    expect(status.matches).toBe(true);
    expect(status.versionNumber).toBe(1);

    // Re-sealing unchanged content is a no-op (same version + hash).
    const again = await sealMinutes(prisma, { meetingId: meeting.id, sealedById: chair.id });
    expect(again.alreadySealed).toBe(true);
    expect(again.versionNumber).toBe(1);

    // Tamper: edit the minutes → the sealed hash no longer matches.
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { minutes: "Meghamisított szöveg." },
    });
    status = await verifyLatestMinutes(prisma, meeting.id);
    expect(status.matches).toBe(false);
    expect(status.sealed).toBe(true);

    // Re-seal the correction → v2.
    const v2 = await sealMinutes(prisma, { meetingId: meeting.id, sealedById: chair.id });
    expect(v2.versionNumber).toBe(2);
    expect(v2.alreadySealed).toBe(false);
    expect(v2.contentHash).not.toBe(v1.contentHash);

    status = await verifyLatestMinutes(prisma, meeting.id);
    expect(status.matches).toBe(true);
    expect(status.versionNumber).toBe(2);
  });

  it("reports unsealed minutes as not sealed", async () => {
    const { building } = await makeBuilding();
    const chair = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const meeting = await makeMeeting(building.id, chair.id, "Nincs lezárva.");
    const status = await verifyLatestMinutes(prisma, meeting.id);
    expect(status.sealed).toBe(false);
    expect(status.versionNumber).toBeNull();
  });
});
