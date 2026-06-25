import "server-only";
import { NextResponse } from "next/server";
import { requireBuildingContext } from "./auth";
import { hasMinimumRole } from "./rbac";
import { prisma } from "./prisma";

/**
 * Asserts the caller is SUPER_ADMIN. Returns the context on success, or throws
 * an error tagged with an HTTP status that {@link adminErrorResponse} maps.
 */
export async function requireSuperAdmin() {
  const ctx = await requireBuildingContext();
  if (!hasMinimumRole(ctx.role, "SUPER_ADMIN")) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return ctx;
}

/** Maps guard/handler errors to a JSON response. */
export function adminErrorResponse(error: unknown): NextResponse {
  const status =
    typeof error === "object" && error && "status" in error
      ? (error as { status?: number }).status
      : undefined;
  if (status === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const msg = error instanceof Error ? error.message : "";
  if (msg === "Unauthorized" || msg === "No building selected")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  console.error("admin feature API error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Writes a feature-console audit row. */
export async function auditFeatureChange(args: {
  userId: string;
  buildingId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      userId: args.userId,
      buildingId: args.buildingId ?? null,
      oldValue: (args.oldValue ?? undefined) as object | undefined,
      newValue: (args.newValue ?? undefined) as object | undefined,
      reason: args.reason,
    },
  });
}
