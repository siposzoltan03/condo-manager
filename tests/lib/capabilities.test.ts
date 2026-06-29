import { describe, it, expect } from "vitest";
import { can, type ActorContext, type Capability } from "@/lib/capabilities";

// Helper: build an actor with sensible defaults, override only what matters.
function actor(overrides: Partial<ActorContext> & Pick<ActorContext, "role">): ActorContext {
  return {
    isChair: false,
    isProfessional: false,
    isAuditor: false,
    ownsAnyUnit: false,
    livesAtUnit: false,
    ...overrides,
  };
}

const REPRESENTATIVE_CAPS: Capability[] = [
  "manage.budget",
  "approve.invoice",
  "vote.start",
  "vote.editMinutes",
  "ticket.assign",
  "announcement.publish",
  "announcement.boardChannel",
  "document.publish.public",
  "document.publish.boardOnly",
];

describe("can() — SUPER_ADMIN scoping", () => {
  it("grants platform + governance caps but never building-legal caps", () => {
    const a = actor({ role: "SUPER_ADMIN" });
    // Platform + governance (app administration).
    expect(can(a, "platform.impersonate")).toBe(true);
    expect(can(a, "platform.featureFlags")).toBe(true);
    expect(can(a, "platform.subscriptions")).toBe(true);
    expect(can(a, "users.manage")).toBe(true);
    expect(can(a, "users.assignRole", { targetRole: "SUPER_ADMIN" })).toBe(true);
    expect(can(a, "units.manage")).toBe(true);
    expect(can(a, "contractor.manage")).toBe(true);
    // Building-legal caps stay false (impersonation flow only).
    expect(can(a, "manage.budget")).toBe(false);
    expect(can(a, "view.building.finance")).toBe(false);
    expect(can(a, "vote.cast")).toBe(false);
    expect(can(a, "residents.viewAll")).toBe(false);
    expect(can(a, "auditor.readAll")).toBe(false);
  });

  it("ignores building-level flags entirely", () => {
    const a = actor({
      role: "SUPER_ADMIN",
      isChair: true,
      isAuditor: true,
      ownsAnyUnit: true,
    });
    for (const cap of REPRESENTATIVE_CAPS) {
      expect(can(a, cap)).toBe(false);
    }
  });
});

describe("can() — representative authority (Tht. § 43)", () => {
  it("BOARD_MEMBER who is chair gets all representative caps", () => {
    const a = actor({ role: "BOARD_MEMBER", isChair: true });
    for (const cap of REPRESENTATIVE_CAPS) {
      expect(can(a, cap)).toBe(true);
    }
  });

  it("BOARD_MEMBER who is NOT chair is blocked on representative caps", () => {
    const a = actor({ role: "BOARD_MEMBER", isChair: false });
    for (const cap of REPRESENTATIVE_CAPS) {
      expect(can(a, cap)).toBe(false);
    }
  });

  it("ADMIN gets all representative caps without chair flag", () => {
    const a = actor({ role: "ADMIN" });
    for (const cap of REPRESENTATIVE_CAPS) {
      expect(can(a, cap)).toBe(true);
    }
  });

  it("OWNER and TENANT never get representative caps", () => {
    const owner = actor({ role: "OWNER", ownsAnyUnit: true });
    const tenant = actor({ role: "TENANT" });
    for (const cap of REPRESENTATIVE_CAPS) {
      expect(can(owner, cap)).toBe(false);
      expect(can(tenant, cap)).toBe(false);
    }
  });
});

describe("can() — building finance visibility", () => {
  it("BOARD_MEMBER (any chair flag) can view building finance", () => {
    expect(can(actor({ role: "BOARD_MEMBER", isChair: false }), "view.building.finance")).toBe(true);
    expect(can(actor({ role: "BOARD_MEMBER", isChair: true }), "view.building.finance")).toBe(true);
  });

  it("ADMIN can view building finance", () => {
    expect(can(actor({ role: "ADMIN" }), "view.building.finance")).toBe(true);
  });

  it("isAuditor flag grants building finance read regardless of role", () => {
    expect(can(actor({ role: "OWNER", isAuditor: true }), "view.building.finance")).toBe(true);
    expect(can(actor({ role: "TENANT", isAuditor: true }), "view.building.finance")).toBe(true);
  });

  it("OWNER without auditor flag cannot view building finance", () => {
    expect(can(actor({ role: "OWNER", ownsAnyUnit: true }), "view.building.finance")).toBe(false);
  });

  it("TENANT without auditor flag cannot view building finance", () => {
    expect(can(actor({ role: "TENANT" }), "view.building.finance")).toBe(false);
  });
});

describe("can() — voting (Tht. § 38)", () => {
  it("ownsAnyUnit drives vote.cast regardless of building role", () => {
    expect(can(actor({ role: "OWNER", ownsAnyUnit: true }), "vote.cast")).toBe(true);
    expect(can(actor({ role: "BOARD_MEMBER", ownsAnyUnit: true }), "vote.cast")).toBe(true);
    expect(can(actor({ role: "OWNER", ownsAnyUnit: false }), "vote.cast")).toBe(false);
  });

  it("TENANT cannot vote even if owns flag somehow set (defence in depth)", () => {
    // ownsAnyUnit=false ⇒ false; with true would technically pass, but a
    // TENANT must never be flagged ownsAnyUnit by the DAL. The matrix
    // delegates correctness to the loader.
    expect(can(actor({ role: "TENANT", ownsAnyUnit: false }), "vote.cast")).toBe(false);
  });
});

describe("can() — own unit finance", () => {
  it("only ownsAnyUnit matters", () => {
    expect(can(actor({ role: "OWNER", ownsAnyUnit: true }), "view.own.unit.finance")).toBe(true);
    expect(can(actor({ role: "TENANT", ownsAnyUnit: false }), "view.own.unit.finance")).toBe(false);
    expect(can(actor({ role: "BOARD_MEMBER", ownsAnyUnit: false }), "view.own.unit.finance")).toBe(false);
  });
});

describe("can() — ticket.report", () => {
  it("any non-SUPER_ADMIN role can report tickets", () => {
    for (const role of ["ADMIN", "BOARD_MEMBER", "AUDITOR", "OWNER", "TENANT"] as const) {
      expect(can(actor({ role }), "ticket.report")).toBe(true);
    }
  });
});

describe("can() — residents visibility", () => {
  it("BOARD_MEMBER and ADMIN see all residents", () => {
    expect(can(actor({ role: "BOARD_MEMBER" }), "residents.viewAll")).toBe(true);
    expect(can(actor({ role: "ADMIN" }), "residents.viewAll")).toBe(true);
  });

  it("OWNER and TENANT see their staircase only", () => {
    expect(can(actor({ role: "OWNER" }), "residents.viewSameStaircase")).toBe(true);
    expect(can(actor({ role: "TENANT" }), "residents.viewSameStaircase")).toBe(true);
    expect(can(actor({ role: "BOARD_MEMBER" }), "residents.viewSameStaircase")).toBe(false);
    expect(can(actor({ role: "AUDITOR" }), "residents.viewSameStaircase")).toBe(false);
  });

  it("AUDITOR sees neither residents.viewAll nor sameStaircase by default", () => {
    expect(can(actor({ role: "AUDITOR" }), "residents.viewAll")).toBe(false);
    expect(can(actor({ role: "AUDITOR" }), "residents.viewSameStaircase")).toBe(false);
  });
});

describe("can() — auditor.readAll", () => {
  it("isAuditor flag is the only gate", () => {
    expect(can(actor({ role: "AUDITOR", isAuditor: true }), "auditor.readAll")).toBe(true);
    expect(can(actor({ role: "OWNER", isAuditor: true }), "auditor.readAll")).toBe(true);
    expect(can(actor({ role: "AUDITOR", isAuditor: false }), "auditor.readAll")).toBe(false);
  });
});

describe("can() — board/admin read context", () => {
  it("view.boardContext: board member, admin, auditor — not owner/tenant/super", () => {
    expect(can(actor({ role: "BOARD_MEMBER" }), "view.boardContext")).toBe(true);
    expect(can(actor({ role: "ADMIN" }), "view.boardContext")).toBe(true);
    expect(can(actor({ role: "OWNER", isAuditor: true }), "view.boardContext")).toBe(true);
    expect(can(actor({ role: "OWNER" }), "view.boardContext")).toBe(false);
    expect(can(actor({ role: "TENANT" }), "view.boardContext")).toBe(false);
    expect(can(actor({ role: "SUPER_ADMIN" }), "view.boardContext")).toBe(false);
  });

  it("view.adminContext: admin only", () => {
    expect(can(actor({ role: "ADMIN" }), "view.adminContext")).toBe(true);
    expect(can(actor({ role: "BOARD_MEMBER", isChair: true }), "view.adminContext")).toBe(false);
    expect(can(actor({ role: "SUPER_ADMIN" }), "view.adminContext")).toBe(false);
  });
});

describe("can() — governance: users.manage / contractor.manage", () => {
  it("ADMIN holds users.manage and contractor.manage; board/auditor do not", () => {
    expect(can(actor({ role: "ADMIN" }), "users.manage")).toBe(true);
    expect(can(actor({ role: "ADMIN" }), "contractor.manage")).toBe(true);
    expect(can(actor({ role: "BOARD_MEMBER", isChair: true }), "users.manage")).toBe(false);
    expect(can(actor({ role: "BOARD_MEMBER", isChair: true }), "contractor.manage")).toBe(false);
    expect(can(actor({ role: "AUDITOR", isAuditor: true }), "contractor.manage")).toBe(false);
  });
});

describe("can() — governance: board-level read (units.manage / contractor.view)", () => {
  it("BOARD_MEMBER, ADMIN, and auditors get board-level read", () => {
    for (const cap of ["units.manage", "contractor.view"] as const) {
      expect(can(actor({ role: "BOARD_MEMBER" }), cap)).toBe(true);
      expect(can(actor({ role: "ADMIN" }), cap)).toBe(true);
      expect(can(actor({ role: "OWNER", isAuditor: true }), cap)).toBe(true);
      expect(can(actor({ role: "OWNER" }), cap)).toBe(false);
      expect(can(actor({ role: "TENANT" }), cap)).toBe(false);
    }
  });
});

describe("can() — governance: users.assignRole (relational escalation)", () => {
  it("ADMIN may assign building/resident roles but not ADMIN or SUPER_ADMIN", () => {
    const adm = actor({ role: "ADMIN" });
    for (const t of ["BOARD_MEMBER", "AUDITOR", "OWNER", "TENANT"] as const) {
      expect(can(adm, "users.assignRole", { targetRole: t })).toBe(true);
    }
    expect(can(adm, "users.assignRole", { targetRole: "ADMIN" })).toBe(false);
    expect(can(adm, "users.assignRole", { targetRole: "SUPER_ADMIN" })).toBe(false);
  });

  it("SUPER_ADMIN may assign any role; lower roles may assign none", () => {
    expect(can(actor({ role: "SUPER_ADMIN" }), "users.assignRole", { targetRole: "ADMIN" })).toBe(true);
    expect(can(actor({ role: "BOARD_MEMBER", isChair: true }), "users.assignRole", { targetRole: "OWNER" })).toBe(false);
    expect(can(actor({ role: "OWNER" }), "users.assignRole", { targetRole: "TENANT" })).toBe(false);
  });
});
