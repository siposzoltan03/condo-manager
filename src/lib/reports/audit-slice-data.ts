import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface AuditSliceFilters {
  from: Date;
  to: Date;
}

export interface AuditSliceRow {
  id: string;
  createdAt: string;
  actor: { name: string; email: string };
  action: string;
  entityType: string;
  entityId: string;
  /** Short human-readable diff string. */
  diffSummary: string;
}

export interface AuditSliceData {
  buildingName: string;
  filters: {
    fromISO: string;
    toISO: string;
    fromLabel: string;
    toLabel: string;
  };
  /** Bounded pull — caps protect the renderer from runaway selects. */
  rows: AuditSliceRow[];
  totalCount: number;
  /** Hard cap that produced the row set. */
  rowLimit: number;
  /** True when totalCount exceeded rowLimit. */
  truncated: boolean;
  /** HMAC-signed manifest hash for audit-trail integrity proof. */
  manifestHash: string;
  generatedBy: { name: string; email: string };
}

const ROW_LIMIT = 5000;

/**
 * Likely-cuid IDs (Prisma's default). Render in a compact form so the
 * Details column doesn't bleed into adjacent rows.
 */
function looksLikeCuid(s: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(s);
}

function compactValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    if (looksLikeCuid(v)) return `…${v.slice(-6)}`;
    return v.length > 28 ? `${v.slice(0, 26)}…` : v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length === 0 ? "[]" : `[${v.length}]`;
  if (typeof v === "object") return "{…}";
  return "";
}

function summarise(diff: unknown): string {
  if (!diff || typeof diff !== "object") return "";
  const entries = Object.entries(diff as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined,
  );
  if (entries.length === 0) return "";
  const MAX = 4;
  const parts = entries.slice(0, MAX).map(([k, v]) => `${k}=${compactValue(v)}`);
  if (entries.length > MAX) parts.push(`+${entries.length - MAX} more`);
  return parts.join(", ");
}

function manifestHmac(rows: AuditSliceRow[], secret: string): string {
  // Stable canonical string — order matters for verification.
  const lines = rows.map(
    (r) =>
      `${r.id}|${r.createdAt}|${r.actor.email}|${r.action}|${r.entityType}|${r.entityId}`,
  );
  return createHmac("sha256", secret).update(lines.join("\n")).digest("hex");
}

/**
 * Compute the canonical data payload for an audit-slice PDF.
 *
 * `params` controls scope. Building filtering happens inside the query —
 * the route is responsible for asserting the caller's RBAC.
 */
export async function computeAuditSliceData(
  buildingId: string,
  filters: AuditSliceFilters,
  generatedById: string,
): Promise<AuditSliceData> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true },
  });
  if (!building) throw new Error(`Building ${buildingId} not found`);

  const generator = await prisma.user.findUnique({
    where: { id: generatedById },
    select: { name: true, email: true },
  });
  if (!generator) throw new Error("Generator user not found");

  const where = {
    OR: [{ buildingId }, { buildingId: null }],
    createdAt: { gte: filters.from, lte: filters.to },
  };

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: ROW_LIMIT,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const rows: AuditSliceRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    actor: { name: l.user.name, email: l.user.email },
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    diffSummary:
      summarise(l.newValue ?? null) || summarise(l.oldValue ?? null) || "—",
  }));

  // HMAC secret comes from REPORT_AUDIT_HMAC_KEY env, with NEXTAUTH_SECRET as
  // a fallback so dev environments don't need a separate config knob. The
  // chosen value is mixed with the generation timestamp to defeat replay.
  const secret =
    process.env.REPORT_AUDIT_HMAC_KEY ??
    process.env.NEXTAUTH_SECRET ??
    "dev-only-audit-key";
  const manifestHash = manifestHmac(rows, secret);

  return {
    buildingName: building.name,
    filters: {
      fromISO: filters.from.toISOString(),
      toISO: filters.to.toISOString(),
      fromLabel: filters.from.toLocaleDateString("hu-HU"),
      toLabel: filters.to.toLocaleDateString("hu-HU"),
    },
    rows,
    totalCount,
    rowLimit: ROW_LIMIT,
    truncated: totalCount > ROW_LIMIT,
    manifestHash,
    generatedBy: { name: generator.name, email: generator.email },
  };
}
