import { z } from "zod";

/**
 * Canonical feature taxonomy.
 *
 * Feature *slugs* are code-owned — `requireFeature("voting.proxy")` must be
 * compile-time checked, and a superadmin must never be able to rename a slug
 * out from under a code reference. The DB `Feature` table mirrors this list
 * (synced by prisma/sync-features.ts) and carries only editable *metadata*
 * (display name, description, sort order, active). Feature *assignment*
 * (which plan / building / flag enables a slug) lives in the DB and is what
 * the superadmin console edits.
 *
 * Naming convention: `module.capability`. New features go here, never as raw
 * strings — and any new slug needs a corresponding DB migration + sync run.
 *
 * Plan: docs/plans/2026-06-23-superadmin-feature-management.md (Phase 1).
 */
export const FEATURES = [
  // Voting
  "voting.basic",
  "voting.weighted",
  "voting.proxy",
  "voting.electronic",
  // Finance
  "finance.ledger",
  "finance.budget",
  "finance.bank-csv",
  "finance.bank-sync-live",
  "finance.pdf-report",
  // Maintenance
  "maintenance.tickets",
  "maintenance.kanban",
  "maintenance.contractors",
  "maintenance.scheduled",
  // Documents
  "documents.basic",
  "documents.versioning",
  "documents.signing",
  // Communication
  "communication.announcements",
  "communication.forum",
  "communication.messages",
  "communication.complaints",
  // Audit
  "audit.basic",
  "audit.export",
  // Platform
  "platform.multi-building",
  "platform.api",
  "platform.sso",
  "platform.custom-branding",
  // AI
  "ai.minutes-summary",
  "ai.classify",
] as const;

export type Feature = (typeof FEATURES)[number];

/** Runtime parser for an untrusted slug (API boundaries, DB rows). */
export const FeatureSchema = z.enum(FEATURES);

/** Convenience guard wrapping {@link FeatureSchema}. */
export function isFeature(slug: string): slug is Feature {
  return FeatureSchema.safeParse(slug).success;
}

/** The module prefix of a slug, e.g. "voting.proxy" → "voting". */
export type FeatureModule =
  | "voting"
  | "finance"
  | "maintenance"
  | "documents"
  | "communication"
  | "audit"
  | "platform"
  | "ai";

export function featureModule(slug: Feature): FeatureModule {
  return slug.split(".")[0] as FeatureModule;
}

/**
 * Feature dependencies — structural truth, so they live in code next to the
 * slugs and are NOT editable from the console. A feature is only ever
 * effective if all of its prerequisites are effective (see
 * src/lib/feature-resolver.ts `applyDependencies`).
 */
export const FEATURE_DEPENDENCIES: Partial<Record<Feature, Feature[]>> = {
  "voting.weighted": ["voting.basic"],
  "voting.proxy": ["voting.basic"],
  "voting.electronic": ["voting.basic"],
  "finance.budget": ["finance.ledger"],
  "finance.bank-csv": ["finance.ledger"],
  "finance.bank-sync-live": ["finance.bank-csv"], // transitive → finance.ledger
  "finance.pdf-report": ["finance.ledger"],
  "maintenance.kanban": ["maintenance.tickets"],
  "maintenance.contractors": ["maintenance.tickets"],
  "maintenance.scheduled": ["maintenance.tickets"],
  "documents.versioning": ["documents.basic"],
  "documents.signing": ["documents.basic"],
  "audit.export": ["audit.basic"],
};
