import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";
import {
  recordMinutesBoardPosting,
  queueMinutesEmailDeliveries,
  isMinutesDeliveryOverdue,
  overdueMinutesMeetings,
} from "@/lib/voting/minutes-delivery";

async function makeMeeting(buildingId: string, createdById: string, date: Date) {
  return prisma.meeting.create({
    data: { buildingId, createdById, title: "Közgyűlés", date, time: "17:00" },
  });
}

describe("minutes delivery (Tht. § 43)", () => {
  it("queues owner emails, records board posting, and clears the overdue flag", async () => {
    const { building } = await makeBuilding();
    const owner1 = await makeUser({ buildingId: building.id, role: "OWNER" });
    await makeUser({ buildingId: building.id, role: "OWNER" });
    const now = new Date("2026-07-06T00:00:00.000Z");
    // Assembly 10 days ago → past the 8-day deadline.
    const meeting = await makeMeeting(building.id, owner1.id, new Date("2026-06-26T00:00:00.000Z"));

    // Overdue before any delivery.
    expect(await isMinutesDeliveryOverdue(prisma, meeting.id, now)).toBe(true);

    // Queue owner emails (both owners have an email on file).
    const queued = await queueMinutesEmailDeliveries(prisma, {
      meetingId: meeting.id,
      buildingId: building.id,
    });
    expect(queued).toBeGreaterThanOrEqual(2);

    // Queued (not DELIVERED) rows do NOT clear the overdue flag.
    expect(await isMinutesDeliveryOverdue(prisma, meeting.id, now)).toBe(true);

    // Board posting is DELIVERED immediately → clears overdue.
    await recordMinutesBoardPosting(prisma, meeting.id);
    expect(await isMinutesDeliveryOverdue(prisma, meeting.id, now)).toBe(false);
  });

  it("does not flag a meeting within the 8-day window", async () => {
    const { building } = await makeBuilding();
    const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
    const now = new Date("2026-07-06T00:00:00.000Z");
    // Assembly 3 days ago → still inside the window.
    const meeting = await makeMeeting(building.id, owner.id, new Date("2026-07-03T00:00:00.000Z"));
    expect(await isMinutesDeliveryOverdue(prisma, meeting.id, now)).toBe(false);
  });

  it("overdueMinutesMeetings lists past-deadline meetings without a DELIVERED row", async () => {
    const { building } = await makeBuilding();
    const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
    const now = new Date("2026-07-06T00:00:00.000Z");
    const overdueMeeting = await makeMeeting(building.id, owner.id, new Date("2026-06-20T00:00:00.000Z"));

    const list = await overdueMinutesMeetings(prisma, { now });
    const ids = list.map((m) => m.meetingId);
    expect(ids).toContain(overdueMeeting.id);
    const row = list.find((m) => m.meetingId === overdueMeeting.id)!;
    expect(row.daysOverdue).toBeGreaterThanOrEqual(1);

    // After a DELIVERED board posting it drops off the list.
    await recordMinutesBoardPosting(prisma, overdueMeeting.id);
    const list2 = await overdueMinutesMeetings(prisma, { now });
    expect(list2.map((m) => m.meetingId)).not.toContain(overdueMeeting.id);
  });
});
