import type { BuildingRole } from "@prisma/client";
import {
  can,
  type ActorContext,
  type Capability,
  type CapabilityOpts,
} from "./capabilities";

export { can } from "./capabilities";
export type { ActorContext, Capability, CapabilityOpts } from "./capabilities";

/**
 * Capability authorization, layered on the can() matrix
 * (src/lib/capabilities.ts). This is the canonical authorization gate across
 * the whole app — it fully replaced the former `hasMinimumRole` / `requireRole`
 * flat hierarchy (now deleted).
 *
 * Two role models live in the matrix:
 *  - BUILDING-LEVEL caps (finance, voting, maintenance, …): SUPER_ADMIN is NOT
 *    special-cased — it holds no building powers (building impersonation is a
 *    separate flow).
 *  - GOVERNANCE caps (users, units, buildings, invitations, audit, admin
 *    console, contractor CRUD) + the relational `users.assignRole` escalation:
 *    SUPER_ADMIN + ADMIN hold these (see SUPER_ADMIN_CAPS in capabilities.ts).
 */

/** The subset of requireBuildingContext()'s result that feeds the matrix. */
export interface BuildingActor {
  role: string;
  isChair?: boolean;
  ownsAnyUnit?: boolean;
  isAuditor?: boolean;
  isProfessional?: boolean;
}

/** Build a typed ActorContext from a building context. */
export function actorFrom(ctx: BuildingActor): ActorContext {
  return {
    role: ctx.role as BuildingRole,
    isChair: ctx.isChair,
    ownsAnyUnit: ctx.ownsAnyUnit,
    isAuditor: ctx.isAuditor,
    isProfessional: ctx.isProfessional,
  };
}

/** Boolean check — for the inline route style: `if (!allows(ctx, cap)) return 403`.
 *  Pass `opts` for relational caps, e.g. `allows(ctx, "users.assignRole", { targetRole })`. */
export function allows(
  ctx: BuildingActor,
  cap: Capability,
  opts?: CapabilityOpts,
): boolean {
  return can(actorFrom(ctx), cap, opts);
}

/**
 * True if the actor has ANY of the capabilities. For surfaces reachable via
 * more than one right — e.g. the /finance entry, which an OWNER reaches via
 * view.own.unit.finance and a board member via view.building.finance.
 */
export function allowsAny(ctx: BuildingActor, ...caps: Capability[]): boolean {
  const actor = actorFrom(ctx);
  return caps.some((cap) => can(actor, cap));
}

/**
 * Throwing gate — for server actions / DAL functions (mirrors requireRole).
 * Throws a {status:403}-tagged Error that adminErrorResponse() and the usual
 * route catch blocks already map to a 403 response.
 */
export function requireCapability(
  ctx: BuildingActor,
  cap: Capability,
  opts?: CapabilityOpts,
): void {
  if (!can(actorFrom(ctx), cap, opts)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
