import { describe, it, expect } from "vitest";
import { queueEmailDeliveriesForAnnouncement } from "@/lib/announcement-delivery";

type Member = {
  userId: string;
  role: string;
  user: {
    email: string | null;
    unitUsers: { relationship: "OWNER" | "TENANT"; contactConsentAt: Date | null }[];
  };
};

function fakePrisma(members: Member[]) {
  const created: unknown[] = [];
  return {
    captured: created,
    prisma: {
      userBuilding: {
        findMany: async () => members,
      },
      announcementDelivery: {
        createMany: async ({ data }: { data: unknown[] }) => {
          created.push(...data);
          return { count: data.length };
        },
      },
    } as unknown as Parameters<typeof queueEmailDeliveriesForAnnouncement>[0],
  };
}

describe("queueEmailDeliveriesForAnnouncement", () => {
  it("queues owners with email", async () => {
    const f = fakePrisma([
      {
        userId: "u1",
        role: "OWNER",
        user: { email: "a@b.hu", unitUsers: [{ relationship: "OWNER", contactConsentAt: null }] },
      },
    ]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(1);
    expect(f.captured).toHaveLength(1);
  });

  it("skips owners with no email", async () => {
    const f = fakePrisma([
      {
        userId: "u1",
        role: "OWNER",
        user: { email: null, unitUsers: [{ relationship: "OWNER", contactConsentAt: null }] },
      },
    ]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(0);
  });

  it("skips tenants without contact consent", async () => {
    const f = fakePrisma([
      {
        userId: "u_tenant",
        role: "TENANT",
        user: { email: "t@b.hu", unitUsers: [{ relationship: "TENANT", contactConsentAt: null }] },
      },
    ]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(0);
  });

  it("queues tenants with explicit consent", async () => {
    const f = fakePrisma([
      {
        userId: "u_tenant",
        role: "TENANT",
        user: {
          email: "t@b.hu",
          unitUsers: [{ relationship: "TENANT", contactConsentAt: new Date() }],
        },
      },
    ]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(1);
  });

  it("queues board members with no UnitUser row", async () => {
    // Officer without an attached unit (e.g. external chair) — must still
    // receive the announcement.
    const f = fakePrisma([
      {
        userId: "u_chair",
        role: "BOARD_MEMBER",
        user: { email: "chair@b.hu", unitUsers: [] },
      },
    ]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(1);
  });

  it("mixed building: only consent-clear recipients land", async () => {
    const f = fakePrisma([
      {
        userId: "u_owner",
        role: "OWNER",
        user: { email: "o@b.hu", unitUsers: [{ relationship: "OWNER", contactConsentAt: null }] },
      },
      {
        userId: "u_tenant_yes",
        role: "TENANT",
        user: {
          email: "ty@b.hu",
          unitUsers: [{ relationship: "TENANT", contactConsentAt: new Date() }],
        },
      },
      {
        userId: "u_tenant_no",
        role: "TENANT",
        user: { email: "tn@b.hu", unitUsers: [{ relationship: "TENANT", contactConsentAt: null }] },
      },
      {
        userId: "u_no_email",
        role: "OWNER",
        user: { email: null, unitUsers: [{ relationship: "OWNER", contactConsentAt: null }] },
      },
    ]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(2);
    const userIds = (f.captured as { userId: string }[]).map((r) => r.userId).sort();
    expect(userIds).toEqual(["u_owner", "u_tenant_yes"]);
  });

  it("returns 0 and skips createMany when no eligible recipients", async () => {
    const f = fakePrisma([]);
    const n = await queueEmailDeliveriesForAnnouncement(f.prisma, {
      messageId: "m1",
      buildingId: "b1",
    });
    expect(n).toBe(0);
    expect(f.captured).toHaveLength(0);
  });
});
