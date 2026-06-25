import { createHash } from "node:crypto";

/**
 * Compute a stable SHA-256 footer hash for a generated report. Same
 * input → same hash, so re-rendered identical reports have matching
 * fingerprints and the report-cache layer in Phase 2 can dedupe.
 *
 * The hash deliberately covers ONLY the data, not formatting concerns
 * like font version or page size — small visual tweaks shouldn't
 * invalidate stored copies.
 */
export function computeReportHash(payload: unknown): string {
  const json = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(json).digest("hex");
}

/** Short variant for the footer line — first 16 hex chars. */
export function shortHash(full: string): string {
  return full.slice(0, 16);
}
