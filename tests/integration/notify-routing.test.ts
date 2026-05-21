import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeContractorOrg,
  makeContractorUser,
  makeUser,
} from "../fixtures";

// Don't touch BullMQ / Redis in tests — stub the queue.
vi.mock("@/lib/queue", () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) },
  scheduledQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

const { notify, NotificationType } = await import("@/lib/notifications");

describe("notify — recipient routing", () => {
  it("writes Notification rows on the userId column for condo recipients", async () => {
    const { building } = await makeBuilding();
    const a = await makeUser({ buildingId: building.id });
    const b = await makeUser({ buildingId: building.id });

    await notify({
      userIds: [a.id, b.id],
      type: NotificationType.ANNOUNCEMENT_NEW,
      title: "Hello",
      body: "Body",
      entityType: "Announcement",
      entityId: "ann_1",
    });

    const rows = await prisma.notification.findMany({
      where: { userId: { in: [a.id, b.id] } },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.userId).not.toBeNull();
      expect(r.contractorUserId).toBeNull();
      expect(r.type).toBe("ANNOUNCEMENT_NEW");
      expect(r.entityType).toBe("Announcement");
    }
  });

  it("writes Notification rows on the contractorUserId column for contractor recipients", async () => {
    const { org } = await makeContractorOrg();
    const cu1 = await makeContractorUser({ orgId: org.id });
    const cu2 = await makeContractorUser({ orgId: org.id, role: "STAFF" });

    await notify({
      contractorUserIds: [cu1.id, cu2.id],
      type: NotificationType.MARKETPLACE_BID_WON,
      title: "You won",
      body: "Congrats",
      entityType: "MarketplacePublication",
      entityId: "pub_1",
    });

    const rows = await prisma.notification.findMany({
      where: { contractorUserId: { in: [cu1.id, cu2.id] } },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.contractorUserId).not.toBeNull();
      expect(r.userId).toBeNull();
      expect(r.type).toBe("MARKETPLACE_BID_WON");
    }
  });

  it("skips a user whose matrix has every channel disabled for the event key", async () => {
    const { building } = await makeBuilding();
    const optedOut = await makeUser({ buildingId: building.id });
    const optedIn = await makeUser({ buildingId: building.id });

    // Marketplace row: all channels off → no Notification row should be
    // created for this user when a MARKETPLACE_* event fires.
    await prisma.user.update({
      where: { id: optedOut.id },
      data: {
        notificationPreferences: {
          matrix: {
            marketplace: {
              email: false,
              push: false,
              sms: false,
              digest: false,
            },
          },
        },
      },
    });
    // optedIn keeps default prefs (null matrix) → fallback fires.

    await notify({
      userIds: [optedOut.id, optedIn.id],
      type: NotificationType.MARKETPLACE_NEW_BID,
      title: "New bid",
      body: "Body",
    });

    const optedOutRows = await prisma.notification.count({
      where: { userId: optedOut.id },
    });
    const optedInRows = await prisma.notification.count({
      where: { userId: optedIn.id },
    });
    expect(optedOutRows).toBe(0);
    expect(optedInRows).toBe(1);
  });
});
