import { describe, it, expect } from "vitest";
import {
  getRegistryStatus,
  shouldNagAboutRegistry,
} from "@/lib/officer-registry";

const DEADLINE = new Date("2026-10-31T23:59:59+02:00");

function building(overrides: {
  registeredAt?: Date | null;
  deadline?: Date;
}) {
  return {
    representativeRegisteredAt: overrides.registeredAt ?? null,
    representativeRegistryDeadline: overrides.deadline ?? DEADLINE,
  };
}

describe("getRegistryStatus — registered branch", () => {
  it("returns kind=registered when the row has a registration timestamp", () => {
    const registeredAt = new Date("2026-04-01T10:00:00Z");
    const s = getRegistryStatus(
      building({ registeredAt }),
      new Date("2026-11-15T00:00:00Z"),
    );
    expect(s.kind).toBe("registered");
    if (s.kind === "registered") {
      expect(s.at).toEqual(registeredAt);
    }
  });
});

describe("getRegistryStatus — deadline boundaries", () => {
  it("60 days before deadline: due-soon (≤60-day window)", () => {
    const now = new Date(DEADLINE.getTime() - 60 * 86_400_000);
    const s = getRegistryStatus(building({}), now);
    expect(s.kind).toBe("due-soon");
    if (s.kind === "due-soon") expect(s.daysLeft).toBe(60);
  });

  it("61 days before deadline: ok (outside window)", () => {
    const now = new Date(DEADLINE.getTime() - 61 * 86_400_000);
    const s = getRegistryStatus(building({}), now);
    expect(s.kind).toBe("ok");
    if (s.kind === "ok") expect(s.daysLeft).toBe(61);
  });

  it("1 day before deadline: due-soon", () => {
    const now = new Date(DEADLINE.getTime() - 86_400_000);
    const s = getRegistryStatus(building({}), now);
    expect(s.kind).toBe("due-soon");
    if (s.kind === "due-soon") expect(s.daysLeft).toBe(1);
  });

  it("exactly at deadline: due-soon with 0 daysLeft", () => {
    const s = getRegistryStatus(building({}), DEADLINE);
    expect(s.kind).toBe("due-soon");
    if (s.kind === "due-soon") expect(s.daysLeft).toBe(0);
  });

  it("1 day past deadline: overdue", () => {
    const now = new Date(DEADLINE.getTime() + 86_400_000);
    const s = getRegistryStatus(building({}), now);
    expect(s.kind).toBe("overdue");
    if (s.kind === "overdue") expect(s.daysOverdue).toBe(1);
  });

  it("30 days past deadline: overdue with daysOverdue=30", () => {
    const now = new Date(DEADLINE.getTime() + 30 * 86_400_000);
    const s = getRegistryStatus(building({}), now);
    expect(s.kind).toBe("overdue");
    if (s.kind === "overdue") expect(s.daysOverdue).toBe(30);
  });
});

describe("shouldNagAboutRegistry", () => {
  it("nags when due-soon", () => {
    const now = new Date(DEADLINE.getTime() - 7 * 86_400_000);
    expect(shouldNagAboutRegistry(getRegistryStatus(building({}), now))).toBe(true);
  });

  it("nags when overdue", () => {
    const now = new Date(DEADLINE.getTime() + 7 * 86_400_000);
    expect(shouldNagAboutRegistry(getRegistryStatus(building({}), now))).toBe(true);
  });

  it("stays quiet when ok", () => {
    const now = new Date(DEADLINE.getTime() - 200 * 86_400_000);
    expect(shouldNagAboutRegistry(getRegistryStatus(building({}), now))).toBe(false);
  });

  it("stays quiet when registered", () => {
    const registeredAt = new Date("2026-04-01T10:00:00Z");
    expect(
      shouldNagAboutRegistry(
        getRegistryStatus(building({ registeredAt }), new Date()),
      ),
    ).toBe(false);
  });
});
