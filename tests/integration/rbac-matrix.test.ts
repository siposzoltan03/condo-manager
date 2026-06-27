import { describe, it, expect } from "vitest";
import { can, type ActorContext, type Capability } from "@/lib/capabilities";

/**
 * Locks the full capability matrix from src/lib/capabilities.ts. Data-driven:
 * each actor variant lists the capabilities it SHOULD be allowed; every other
 * capability must be denied. Any future change to can() that shifts a cell
 * breaks this test on purpose.
 */

const ALL_CAPS: Capability[] = [
  "manage.budget",
  "approve.invoice",
  "view.building.finance",
  "view.own.unit.finance",
  "vote.cast",
  "vote.start",
  "vote.editMinutes",
  "ticket.report",
  "ticket.assign",
  "announcement.publish",
  "announcement.boardChannel",
  "document.publish.public",
  "document.publish.boardOnly",
  "residents.viewAll",
  "residents.viewSameStaircase",
  "platform.impersonate",
  "platform.featureFlags",
  "auditor.readAll",
];

// Representative-authority caps (Tht. § 43): ADMIN or BOARD_MEMBER+chair only.
const REPRESENTATIVE: Capability[] = [
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

interface Case {
  name: string;
  actor: ActorContext;
  /** Capabilities expected ALLOWED; everything else must be denied. */
  allowed: Capability[];
}

const cases: Case[] = [
  {
    name: "SUPER_ADMIN — platform caps only, never building powers",
    actor: { role: "SUPER_ADMIN" },
    allowed: ["platform.impersonate", "platform.featureFlags"],
  },
  {
    name: "ADMIN — representative powers + building finance + residents",
    actor: { role: "ADMIN" },
    allowed: [
      ...REPRESENTATIVE,
      "view.building.finance",
      "ticket.report",
      "residents.viewAll",
    ],
  },
  {
    name: "BOARD_MEMBER chair — representative authority (Tht. § 43)",
    actor: { role: "BOARD_MEMBER", isChair: true },
    allowed: [
      ...REPRESENTATIVE,
      "view.building.finance",
      "ticket.report",
      "residents.viewAll",
    ],
  },
  {
    name: "BOARD_MEMBER non-chair — reads finance + residents, NO representative powers",
    actor: { role: "BOARD_MEMBER", isChair: false },
    allowed: ["view.building.finance", "ticket.report", "residents.viewAll"],
  },
  {
    name: "OWNER (owns a unit) — votes, own-unit finance, same staircase",
    actor: { role: "OWNER", ownsAnyUnit: true },
    allowed: [
      "view.own.unit.finance",
      "vote.cast",
      "ticket.report",
      "residents.viewSameStaircase",
    ],
  },
  {
    name: "OWNER (owns no unit) — cannot vote or see own-unit finance",
    actor: { role: "OWNER", ownsAnyUnit: false },
    allowed: ["ticket.report", "residents.viewSameStaircase"],
  },
  {
    name: "TENANT — no vote (Tht. § 38); report + same-staircase only",
    actor: { role: "TENANT", ownsAnyUnit: false },
    allowed: ["ticket.report", "residents.viewSameStaircase"],
  },
  {
    name: "OWNER + auditor — adds building-finance view + auditor.readAll",
    actor: { role: "OWNER", ownsAnyUnit: true, isAuditor: true },
    allowed: [
      "view.own.unit.finance",
      "vote.cast",
      "ticket.report",
      "residents.viewSameStaircase",
      "view.building.finance",
      "auditor.readAll",
    ],
  },
];

describe("capability matrix — can()", () => {
  // One assertion per actor (not per cap): comparing the full allowed-set
  // gives a precise diff on failure while avoiding 144 harness TRUNCATEs.
  for (const c of cases) {
    it(c.name, () => {
      const actualAllowed = ALL_CAPS.filter((cap) => can(c.actor, cap)).sort();
      expect(actualAllowed).toEqual([...c.allowed].sort());
    });
  }
});
