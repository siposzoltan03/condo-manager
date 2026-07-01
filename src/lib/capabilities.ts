import type { BuildingRole } from "@prisma/client";

/**
 * Capability matrix for the building-level role model — the single source of
 * authorization truth (action-keyed). It replaced the former flat role
 * hierarchy, which has been removed.
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
  // ── Board-/admin-level read context. The generic "is this user board+ / admin+"
  //    visibility flags (show internal fields, board-only UI) that the legacy
  //    hasMinimumRole(role,"BOARD_MEMBER"/"ADMIN") encoded. Read-only — they do
  //    NOT confer representative authority (that still needs isChair).
  | "view.boardContext"
  | "view.adminContext"
  /** Operational board actions that are NOT Tht. § 43 representative acts —
   *  any board member (or admin) may do them: complaint triage, complaint
   *  categories, channel-message moderation, resignation acknowledgement,
   *  pending-agenda handling. Distinct from chair-only representative caps. */
  | "board.manage"
  | "platform.admin"
  | "platform.impersonate"
  | "platform.featureFlags"
  | "auditor.readAll"
  // ── Governance (app administration, NOT Tht. representative acts). Unlike
  //    building capabilities, SUPER_ADMIN DOES hold these.
  | "users.manage"
  | "users.assignRole"
  /** Initiate/approve a dual-control resident removal. Baseline ADMIN;
   *  delegatable to a board member via the delete_resident grant. The
   *  two-person control (distinct initiator + approver) is enforced in the
   *  action, not here. */
  | "resident.remove"
  /** Propose a bylaws/governance change. Representative authority or ADMIN by
   *  default; delegatable to a board member via the modify_bylaws grant. The
   *  change only applies once the backing assembly vote passes. */
  | "bylaws.modify"
  | "units.manage"
  | "contractor.view"
  | "contractor.manage"
  | "building.manage"
  | "audit.read"
  | "platform.subscriptions";

/** Optional relational context for capabilities that compare the actor to a
 *  target — currently only `users.assignRole` (you may not grant a role at or
 *  above your own authority). */
export interface CapabilityOpts {
  targetRole?: BuildingRole;
}

/** Governance caps SUPER_ADMIN holds. Building-legal caps are NOT here —
 *  SUPER_ADMIN gets those only via the impersonation flow. */
const SUPER_ADMIN_CAPS: ReadonlySet<Capability> = new Set<Capability>([
  "platform.admin",
  "platform.impersonate",
  "platform.featureFlags",
  "platform.subscriptions",
  "users.manage",
  "users.assignRole",
  "units.manage",
  "contractor.view",
  "contractor.manage",
  "building.manage",
  "audit.read",
]);

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
  /** BoardPermission keys explicitly granted to this member for the active
   *  building (the per-resident "permissions" editor). Additive delegation —
   *  a grant can unlock an operational capability the base role lacks. See
   *  GRANT_UNLOCKS. Loaded per-request in requireBuildingContext(). */
  grants?: readonly string[];
}

/**
 * Maps a delegatable capability → the BoardPermission grant key that unlocks
 * it. A board member holding the grant gets the capability even though their
 * base role wouldn't. Additive only — never removes access. Grants without a
 * clean capability target (edit_resident_contact, delete_resident,
 * modify_bylaws) are intentionally not wired: each would need a dedicated
 * capability + gating on the underlying action.
 */
const GRANT_UNLOCKS: Partial<Record<Capability, string>> = {
  "manage.budget": "financial_full",
  "view.building.finance": "financial_full",
  "approve.invoice": "invoice_signoff",
  "announcement.publish": "board_post",
  "announcement.boardChannel": "board_post",
  "vote.start": "vote_create",
  "ticket.assign": "maintenance_orders",
  "resident.remove": "delete_resident",
  "bylaws.modify": "modify_bylaws",
};

export function can(
  actor: ActorContext,
  cap: Capability,
  opts?: CapabilityOpts,
): boolean {
  // SUPER_ADMIN holds platform + governance caps (app administration) but no
  // building-legal powers without the explicit impersonation flow.
  if (actor.role === "SUPER_ADMIN") {
    return SUPER_ADMIN_CAPS.has(cap);
  }

  // Additive delegation: an explicit board-permission grant unlocks the mapped
  // operational capability regardless of what the base role allows. Returns
  // true only — it can never reduce access below the role baseline below.
  if (actor.grants && actor.grants.length > 0) {
    const grantKey = GRANT_UNLOCKS[cap];
    if (grantKey && actor.grants.includes(grantKey)) return true;
  }

  // Representative authority — Tht. § 43. Either the sole közös
  // képviselő or the intézőbizottság elnök. The schema enforces
  // at-most-one-chair-per-building via a partial unique index.
  const hasRepresentativeAuthority =
    actor.role === "BOARD_MEMBER" && actor.isChair === true;

  // Auditors are peers of board members for read access (Tht. § 27(3)).
  const isBoardLevel =
    actor.role === "BOARD_MEMBER" ||
    actor.role === "ADMIN" ||
    actor.isAuditor === true;

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

    case "view.boardContext":
      // Board-level read visibility (board member, admin, or auditor peer).
      return isBoardLevel;

    case "view.adminContext":
      // Admin-level read visibility.
      return actor.role === "ADMIN";

    case "board.manage":
      // Operational board work — any board member or admin (auditors are
      // read-only oversight, so excluded; not chair-gated).
      return actor.role === "BOARD_MEMBER" || actor.role === "ADMIN";

    case "residents.viewAll":
      return actor.role === "BOARD_MEMBER" || actor.role === "ADMIN";

    case "residents.viewSameStaircase":
      // Tht. § 16, § 38 — every tulajdonostárs and bérlő can see their
      // own staircase. RESIDENT is dropped in Phase 3b; only OWNER and
      // TENANT remain as the resident-level roles.
      return actor.role === "OWNER" || actor.role === "TENANT";

    case "auditor.readAll":
      return actor.isAuditor === true;

    // ── Governance ───────────────────────────────────────────────────────
    case "users.manage":
      // Create/edit/deactivate users, resident permissions, board perms.
      return actor.role === "ADMIN";

    case "resident.remove":
      // Baseline ADMIN; a board member gets it via the delete_resident grant
      // (handled by the additive GRANT_UNLOCKS check above). Two-person control
      // (distinct initiator + approver) is enforced in the removal action.
      return actor.role === "ADMIN";

    case "bylaws.modify":
      // Propose a bylaws/governance change (applied only via a passed assembly
      // vote). Representative authority or ADMIN; a board member gets it via
      // the modify_bylaws grant (additive check above).
      return hasRepresentativeAuthority || actor.role === "ADMIN";

    case "users.assignRole": {
      // Only ADMIN reaches here (SUPER_ADMIN handled above). An ADMIN may
      // assign building/resident roles but NOT grant ADMIN or SUPER_ADMIN —
      // those require a SUPER_ADMIN.
      if (actor.role !== "ADMIN") return false;
      const target = opts?.targetRole;
      return target !== "ADMIN" && target !== "SUPER_ADMIN";
    }

    case "units.manage":
    case "contractor.view":
      // Board-level read/management (auditors included as peers).
      return isBoardLevel;

    case "contractor.manage":
      return actor.role === "ADMIN";

    case "audit.read":
      // Audit-log access — admin (super via the early return above).
      return actor.role === "ADMIN";

    case "building.manage":
      // Building CRUD — platform-level, SUPER_ADMIN only (handled above).
      return false;

    case "platform.subscriptions":
      // Platform plan overrides — SUPER_ADMIN only (handled above).
      return false;

    default:
      return false;
  }
}
