import type { BuildingRole } from "@prisma/client";

/**
 * Capability matrix for the building-level role model. Replaces the flat
 * `hasMinimumRole()` hierarchy with action-keyed authorization.
 *
 * Plan ref: docs/plans/2026-04-27-roles-legal-alignment.md, Phase 1.
 *
 * Why this exists:
 *   - Tht. § 43 vests representative authority in *either* a sole közös
 *     képviselő *or* the chair (elnök) of an intézőbizottság. The flat
 *     `BOARD_MEMBER` enum can't express "this board member is the chair";
 *     we need an `isChair` flag combined with role to gate representative
 *     capabilities (start a vote, publish board announcements, etc.).
 *   - SUPER_ADMIN should not have building-level powers without an
 *     explicit impersonation flow (separate plan); it only gets platform
 *     capabilities.
 *   - Voting/owner-finance gating keys off "owns at least one unit"
 *     (`ownsAnyUnit`), not on RESIDENT-vs-TENANT, per Tht. § 16, § 38.
 *
 * The matrix is intentionally not exhaustive in this phase — it covers
 * the cases needed to wire `rbac.ts`. New capabilities are added as
 * surfaces start consuming them.
 */

export type Capability =
  | "manage.budget"
  | "approve.invoice"
  | "view.building.finance"
  | "view.own.unit.finance"
  | "vote.cast"
  | "vote.start"
  | "vote.editMinutes"
  | "ticket.report"
  | "ticket.assign"
  | "announcement.publish"
  | "announcement.boardChannel"
  | "document.publish.public"
  | "document.publish.boardOnly"
  | "residents.viewAll"
  | "residents.viewSameStaircase"
  | "platform.impersonate"
  | "platform.featureFlags"
  | "auditor.readAll";

export interface ActorContext {
  role: BuildingRole;
  /** True if this user holds the chair seat for the current building.
   *  Tht. § 27(2)–(3): elnök of an intézőbizottság OR the sole közös
   *  képviselő. */
  isChair?: boolean;
  /** True if this user is registered as a professional manager
   *  (üzletszerű kezelő). Tht. § 52, § 54 — not currently used to gate
   *  capabilities but tracked so banners/reports can flag compliance. */
  isProfessional?: boolean;
  /** True if this user is a member of the számvizsgáló bizottság or a
   *  registered external auditor. Populated in Phase 2. */
  isAuditor?: boolean;
  /** True if the user owns ≥1 unit in this building (UnitUser with
   *  relationship = OWNER). Populated in Phase 3. */
  ownsAnyUnit?: boolean;
  /** UX hint only — tells you whether the user actually lives at one of
   *  their units. Never gate privilege on this; Tht. has no legal
   *  distinction between "rezidens" and "távoli tulajdonos". */
  livesAtUnit?: boolean;
}

export function can(actor: ActorContext, cap: Capability): boolean {
  // SUPER_ADMIN gets platform caps only — never building-level powers
  // without explicit impersonation (out of scope, separate plan).
  if (actor.role === "SUPER_ADMIN") {
    return cap === "platform.impersonate" || cap === "platform.featureFlags";
  }

  // Representative authority — Tht. § 43. Either the sole közös
  // képviselő or the intézőbizottság elnök. The schema enforces
  // at-most-one-chair-per-building via a partial unique index.
  const hasRepresentativeAuthority =
    actor.role === "BOARD_MEMBER" && actor.isChair === true;

  switch (cap) {
    case "manage.budget":
    case "approve.invoice":
    case "vote.start":
    case "vote.editMinutes":
    case "ticket.assign":
    case "announcement.publish":
    case "announcement.boardChannel":
    case "document.publish.public":
    case "document.publish.boardOnly":
      return hasRepresentativeAuthority || actor.role === "ADMIN";

    case "view.building.finance":
      return (
        actor.role === "BOARD_MEMBER" ||
        actor.role === "ADMIN" ||
        actor.isAuditor === true
      );

    case "view.own.unit.finance":
      return actor.ownsAnyUnit === true;

    case "vote.cast":
      // Tenants do not vote — Tht. § 38. Only owners.
      return actor.ownsAnyUnit === true;

    case "ticket.report":
      // SUPER_ADMIN is excluded by the early return above; every other
      // role can report a ticket against a building they belong to.
      return true;

    case "residents.viewAll":
      return actor.role === "BOARD_MEMBER" || actor.role === "ADMIN";

    case "residents.viewSameStaircase":
      // Tht. § 16, § 38 — every tulajdonostárs and bérlő can see their
      // own staircase. RESIDENT is dropped in Phase 3b; only OWNER and
      // TENANT remain as the resident-level roles.
      return actor.role === "OWNER" || actor.role === "TENANT";

    case "auditor.readAll":
      return actor.isAuditor === true;

    default:
      return false;
  }
}
