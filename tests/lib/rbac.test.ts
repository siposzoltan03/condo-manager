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
    expect(ROLE_HIERARCHY.RESIDENT).toBe(2);
    expect(ROLE_HIERARCHY.TENANT).toBe(1);
  });
});

describe("hasMinimumRole", () => {
  it("SUPER_ADMIN can access everything", () => {
    expect(hasMinimumRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "BOARD_MEMBER")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "RESIDENT")).toBe(true);
    expect(hasMinimumRole("SUPER_ADMIN", "TENANT")).toBe(true);
  });

  it("ADMIN can access ADMIN and below", () => {
    expect(hasMinimumRole("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasMinimumRole("ADMIN", "BOARD_MEMBER")).toBe(true);
    expect(hasMinimumRole("ADMIN", "RESIDENT")).toBe(true);
    expect(hasMinimumRole("ADMIN", "TENANT")).toBe(true);
  });

  it("BOARD_MEMBER can access BOARD_MEMBER and below, not ADMIN+", () => {
    expect(hasMinimumRole("BOARD_MEMBER", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("BOARD_MEMBER", "ADMIN")).toBe(false);
    expect(hasMinimumRole("BOARD_MEMBER", "BOARD_MEMBER")).toBe(true);
    expect(hasMinimumRole("BOARD_MEMBER", "RESIDENT")).toBe(true);
    expect(hasMinimumRole("BOARD_MEMBER", "TENANT")).toBe(true);
  });

  it("RESIDENT cannot access ADMIN or BOARD_MEMBER resources", () => {
    expect(hasMinimumRole("RESIDENT", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("RESIDENT", "ADMIN")).toBe(false);
    expect(hasMinimumRole("RESIDENT", "BOARD_MEMBER")).toBe(false);
    expect(hasMinimumRole("RESIDENT", "RESIDENT")).toBe(true);
    expect(hasMinimumRole("RESIDENT", "TENANT")).toBe(true);
  });

  it("TENANT has lowest access", () => {
    expect(hasMinimumRole("TENANT", "SUPER_ADMIN")).toBe(false);
    expect(hasMinimumRole("TENANT", "ADMIN")).toBe(false);
    expect(hasMinimumRole("TENANT", "BOARD_MEMBER")).toBe(false);
    expect(hasMinimumRole("TENANT", "RESIDENT")).toBe(false);
    expect(hasMinimumRole("TENANT", "TENANT")).toBe(true);
  });

  it("unknown role returns false for any required role", () => {
    expect(hasMinimumRole("UNKNOWN", "TENANT")).toBe(false);
    expect(hasMinimumRole("UNKNOWN", "RESIDENT")).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("returns true only for ADMIN and SUPER_ADMIN", () => {
    expect(canManageUsers("SUPER_ADMIN")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("BOARD_MEMBER")).toBe(false);
    expect(canManageUsers("RESIDENT")).toBe(false);
    expect(canManageUsers("TENANT")).toBe(false);
  });
});

describe("canManageFinances", () => {
  it("returns true for BOARD_MEMBER and above", () => {
    expect(canManageFinances("SUPER_ADMIN")).toBe(true);
    expect(canManageFinances("ADMIN")).toBe(true);
    expect(canManageFinances("BOARD_MEMBER")).toBe(true);
    expect(canManageFinances("RESIDENT")).toBe(false);
    expect(canManageFinances("TENANT")).toBe(false);
  });
});

describe("canManageAnnouncements", () => {
  it("returns true for BOARD_MEMBER and above", () => {
    expect(canManageAnnouncements("SUPER_ADMIN")).toBe(true);
    expect(canManageAnnouncements("ADMIN")).toBe(true);
    expect(canManageAnnouncements("BOARD_MEMBER")).toBe(true);
    expect(canManageAnnouncements("RESIDENT")).toBe(false);
    expect(canManageAnnouncements("TENANT")).toBe(false);
  });
});

describe("canManageDocuments", () => {
  it("returns true for BOARD_MEMBER and above", () => {
    expect(canManageDocuments("SUPER_ADMIN")).toBe(true);
    expect(canManageDocuments("ADMIN")).toBe(true);
    expect(canManageDocuments("BOARD_MEMBER")).toBe(true);
    expect(canManageDocuments("RESIDENT")).toBe(false);
    expect(canManageDocuments("TENANT")).toBe(false);
  });
});

describe("requireRole", () => {
  it("resolves when user meets minimum role", async () => {
    await expect(requireRole("ADMIN", "ADMIN")).resolves.toBeUndefined();
    await expect(requireRole("SUPER_ADMIN", "RESIDENT")).resolves.toBeUndefined();
    await expect(requireRole("BOARD_MEMBER", "TENANT")).resolves.toBeUndefined();
  });

  it("throws Forbidden when user does not meet minimum role", async () => {
    await expect(requireRole("RESIDENT", "ADMIN")).rejects.toThrow("Forbidden");
    await expect(requireRole("TENANT", "BOARD_MEMBER")).rejects.toThrow("Forbidden");
    await expect(requireRole("BOARD_MEMBER", "SUPER_ADMIN")).rejects.toThrow("Forbidden");
  });
});
