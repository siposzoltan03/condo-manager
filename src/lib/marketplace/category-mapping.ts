import type { SpecialtySlug } from "@/lib/contractor/taxonomy";

/**
 * Default mapping from a maintenance ticket's `category` to the
 * contractor specialty slug that owns it.
 *
 * The publish wizard pre-selects from this map but the user can change
 * it (a STRUCTURAL ticket could be facade or carpentry depending on
 * scope). The mapping is the default, not a constraint.
 */
const CATEGORY_TO_SPECIALTY: Record<string, SpecialtySlug> = {
  PLUMBING: "plumbing",
  ELECTRICAL: "electrical",
  STRUCTURAL: "carpentry",
  COMMON_AREA: "cleaning",
  ELEVATOR: "elevator",
  HEATING: "heating",
  OTHER: "other",
};

export function defaultSpecialtyForCategory(category: string): SpecialtySlug {
  return CATEGORY_TO_SPECIALTY[category] ?? "other";
}

/**
 * Publication-level urgency, separate from ticket urgency. The plan
 * spec uses three buckets with explicit timelines so contractors know
 * what they're committing to.
 */
export const PUBLICATION_URGENCIES = [
  { slug: "URGENT", hu: "Sürgős · 48 óra", en: "Urgent · 48h", days: 2 },
  { slug: "MEDIUM", hu: "Közepes · 14 nap", en: "Medium · 14 days", days: 14 },
  { slug: "PLANNED", hu: "Tervezett · 60 nap", en: "Planned · 60 days", days: 60 },
] as const;

export type PublicationUrgency = (typeof PUBLICATION_URGENCIES)[number]["slug"];

export function defaultPublicationUrgency(ticketUrgency: string): PublicationUrgency {
  if (ticketUrgency === "CRITICAL" || ticketUrgency === "HIGH") return "URGENT";
  if (ticketUrgency === "MEDIUM") return "MEDIUM";
  return "PLANNED";
}

/**
 * Budget bands. Optional — boards aren't required to pick one. We keep
 * the slugs stable and translate the labels (HUF only for now).
 */
export const BUDGET_BANDS = [
  { slug: "LT_100K", hu: "< 100 e Ft", en: "< 100k HUF" },
  { slug: "100K_500K", hu: "100 – 500 e Ft", en: "100k – 500k HUF" },
  { slug: "500K_2M", hu: "500 e – 2 M Ft", en: "500k – 2M HUF" },
  { slug: "GT_2M", hu: "2 M Ft fölött", en: "> 2M HUF" },
] as const;

export type BudgetBand = (typeof BUDGET_BANDS)[number]["slug"];

export function isPublicationUrgency(s: unknown): s is PublicationUrgency {
  return PUBLICATION_URGENCIES.some((u) => u.slug === s);
}

export function isBudgetBand(s: unknown): s is BudgetBand {
  return BUDGET_BANDS.some((b) => b.slug === s);
}
