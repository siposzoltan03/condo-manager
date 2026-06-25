import { describe, it, expect } from "vitest";
import {
  ROLE_HIERARCHY,
  hasMinimumRole,
  canManageUsers,
  canManageFinances,
  canManageAnnouncements,
  canManageDocuments,
  requireRole,
} from "@/lib/rbac";

describe("ROLE_HIERARCHY", () => {
  it("should have correct numeric levels", () => {
    expect(ROLE_HIERARCHY.SUPER_ADMIN).toBe(5);
    expect(ROLE_HIERARCHY.ADMIN).toBe(4);
    expect(ROLE_HIERARCHY.BOARD_MEMBER).toBe(3);
    expect(ROLE_HIERARCHY.OWNER).toBe(2);
    expect(ROLE_HIERARCHY.TENANT).toBe(1);
  });
});

describe("hasMinimumRole", () => {
  it("SUPER_ADMIN can access everything", () => {
    expect(hasMinimumRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "BOARD_MEMBER")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "OWNER")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "TENANT")).toBe(true);
  });

  it("ADMIN can access ADMIN and below", () => {
    expect(hasMinimumRole("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinimumRole("ADMIN", "BOARD_MEMBER")).toBe(true);
    expect(hasMinimumRole("ADMIN", "OWNER")).toBe(true);
    expect(hasMinimumRole("ADMIN", "TENANT")).toBe(true);
  });

  it("BOARD_MEMBER can access BOARD_MEMBER and below, not ADMIN+", () => {
    expect(hasMinimumRole("BOARD_MEMBER", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("BOARD_MEMBER", "ADMIN")).toBe(false);
    expect(hasMinimumRole("BOARD_MEMBER", "BOARD_MEMBER")).toBe(true);
    expect(hasMinimumRole("BOARD_MEMBER", "OWNER")).toBe(true);
    expect(hasMinimumRole("BOARD_MEMBER", "TENANT")).toBe(true);
  });

  it("OWNER cannot access ADMIN or BOARD_MEMBER resources", () => {
    expect(hasMinimumRole("OWNER", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("OWNER", "ADMIN")).toBe(false);
    expect(hasMinimumRole("OWNER", "BOARD_MEMBER")).toBe(false);
    expect(hasMinimumRole("OWNER", "OWNER")).toBe(true);
    expect(hasMinimumRole("OWNER", "TENANT")).toBe(true);
  });

  it("TENANT has lowest access", () => {
    expect(hasMinimumRole("TENANT", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("TENANT", "ADMIN")).toBe(false);
    expect(hasMinimumRole("TENANT", "BOARD_MEMBER")).toBe(false);
    expect(hasMinimumRole("TENANT", "OWNER")).toBe(false);
    expect(hasMinimumRole("TENANT", "TENANT")).toBe(true);
  });

  it("unknown role returns false for any required role", () => {
    expect(hasMinimumRole("UNKNOWN", "TENANT")).toBe(false);
    expect(hasMinimumRole("UNKNOWN", "OWNER")).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("returns true only for ADMIN and SUPER_ADMIN", () => {
    expect(canManageUsers("SUPER_ADMIN")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("BOARD_MEMBER")).toBe(false);
    expect(canManageUsers("OWNER")).toBe(false);
    expect(canManageUsers("TENANT")).toBe(false);
  });
});

// Phase 1 (roles-legal-alignment) changed the semantics of these wrappers:
// they now route through the `can()` matrix, which denies SUPER_ADMIN any
// building-level capability (platform-only) and grants representative caps
// to BOARD_MEMBER via the synthetic `isChair: true` legacy injection in
// `actorOf()`. The OWNER/TENANT branches stay denied.
describe("canManageFinances", () => {
  it("ADMIN and BOARD_MEMBER pass; SUPER_ADMIN, OWNER, TENANT denied", () => {
    expect(canManageFinances("SUPER_ADMIN")).toBe(false);
    expect(canManageFinances("ADMIN")).toBe(true);
    expect(canManageFinances("BOARD_MEMBER")).toBe(true);
    expect(canManageFinances("OWNER")).toBe(false);
    expect(canManageFinances("TENANT")).toBe(false);
  });
});

describe("canManageAnnouncements", () => {
  it("ADMIN and BOARD_MEMBER pass; SUPER_ADMIN, OWNER, TENANT denied", () => {
    expect(canManageAnnouncements("SUPER_ADMIN")).toBe(false);
    expect(canManageAnnouncements("ADMIN")).toBe(true);
    expect(canManageAnnouncements("BOARD_MEMBER")).toBe(true);
    expect(canManageAnnouncements("OWNER")).toBe(false);
    expect(canManageAnnouncements("TENANT")).toBe(false);
  });
});

describe("canManageDocuments", () => {
  it("ADMIN and BOARD_MEMBER pass; SUPER_ADMIN, OWNER, TENANT denied", () => {
    expect(canManageDocuments("SUPER_ADMIN")).toBe(false);
    expect(canManageDocuments("ADMIN")).toBe(true);
    expect(canManageDocuments("BOARD_MEMBER")).toBe(true);
    expect(canManageDocuments("OWNER")).toBe(false);
    expect(canManageDocuments("TENANT")).toBe(false);
  });
});

describe("requireRole", () => {
  it("resolves when user meets minimum role", async () => {
    await expect(requireRole("ADMIN", "ADMIN")).resolves.toBeUndefined();
    await expect(requireRole("SUPER_ADMIN", "OWNER")).resolves.toBeUndefined();
    await expect(requireRole("BOARD_MEMBER", "TENANT")).resolves.toBeUndefined();
  });

  it("throws Forbidden when user does not meet minimum role", async () => {
    await expect(requireRole("OWNER", "ADMIN")).rejects.toThrow("Forbidden");
    await expect(requireRole("TENANT", "BOARD_MEMBER")).rejects.toThrow("Forbidden");
    await expect(requireRole("BOARD_MEMBER", "SUPER_ADMIN")).rejects.toThrow("Forbidden");
  });
});
