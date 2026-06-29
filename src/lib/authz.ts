import type { BuildingRole } from "@prisma/client";
import { can, type ActorContext, type Capability } from "./capabilities";

export { can } from "./capabilities";
export type { ActorContext, Capability } from "./capabilities";

/**
 * Building-capability authorization, layered on the can() matrix
 * (src/lib/capabilities.ts). This is the canonical gate for BUILDING-LEVEL
 * actions — it replaces the legacy `hasMinimumRole` flat hierarchy at those
 * call-sites.
 *
 * STRICT semantics: SUPER_ADMIN is NOT special-cased here — the matrix grants
 * it no building powers (building impersonation is a separate future flow).
 *
 * OUT OF SCOPE (stays on hasMinimumRole / src/lib/rbac.ts): platform & user
 * governance — users, units, buildings, invitations, audit-logs, the admin
 * console, contractor CRUD, and the asymmetric escalation checks (an ADMIN
 * must not grant ADMIN/SUPER_ADMIN). Those are legitimately role-ranked and
 * have no capability mapping.
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

/** Boolean check — for the inline route style: `if (!allows(ctx, cap)) return 403`. */
export function allows(ctx: BuildingActor, cap: Capability): boolean {
  return can(actorFrom(ctx), cap);
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
export function requireCapability(ctx: BuildingActor, cap: Capability): void {
  if (!can(actorFrom(ctx), cap)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
