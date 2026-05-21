import * as dal from "./dal";

/**
 * Trust badges surfaced on contractor cards. Derived from existing
 * data — no separate badge table. Each badge has a stable slug for
 * i18n + analytics. The order of `slugs` is the display order.
 */
export type TrustBadgeSlug =
  | "nav-confirmed"
  | "experienced"
  | "highly-rated"
  | "insured"
  | "district-expert";

export interface TrustSummary {
  orgId: string;
  badges: TrustBadgeSlug[];
  avgRating: number | null;
  ratingCount: number;
  completedJobs: number;
  insuranceValid: boolean;
  navConfirmed: boolean;
  /** Per-context: count of past awards in the publication's city. */
  districtMatches: number;
}

const DISTRICT_EXPERT_MIN = 3;
const EXPERIENCED_MIN = 5;
const HIGH_RATING_MIN = 4.0;
const HIGH_RATING_MIN_COUNT = 3;

/**
 * Batch trust summaries for a set of contractor orgs, in the context of
 * one publication (so "district expert" / "helyszínhez közeli" can be
 * decided against the publication's city).
 */
export async function getTrustSummaries(
  orgIds: string[],
  publicationCity: string,
): Promise<Record<string, TrustSummary>> {
  if (orgIds.length === 0) return {};

  const [orgs, ratings, completed, docs] = await Promise.all([
    dal.findOrgsNavStatus(orgIds),
    dal.findRatingsForOrgs(orgIds),
    dal.findCompletedTicketsForOrgs(orgIds),
    dal.findInsuranceDocsForOrgs(orgIds),
  ]);

  const result: Record<string, TrustSummary> = {};
  for (const id of orgIds) {
    const org = orgs.find((o) => o.id === id);
    const ratingArr = ratings.filter((r) => r.contractorOrgId === id);
    const completedArr = completed.filter((c) => c.awardedContractorId === id);
    const docArr = docs.filter((d) => d.orgId === id);

    const navConfirmed = !!org?.navConfirmedAt;
    const ratingCount = ratingArr.length;
    const avgRating =
      ratingCount > 0
        ? ratingArr.reduce((s, r) => s + r.rating, 0) / ratingCount
        : null;
    const completedJobs = completedArr.length;
    const districtMatches = completedArr.filter(
      (c) => c.building.city === publicationCity,
    ).length;
    const insuranceValid = docArr.some(
      (d) => !d.validUntil || d.validUntil.getTime() > Date.now(),
    );

    const badges: TrustBadgeSlug[] = [];
    if (navConfirmed) badges.push("nav-confirmed");
    if (insuranceValid) badges.push("insured");
    if (completedJobs >= EXPERIENCED_MIN) badges.push("experienced");
    if (
      avgRating !== null &&
      avgRating >= HIGH_RATING_MIN &&
      ratingCount >= HIGH_RATING_MIN_COUNT
    ) {
      badges.push("highly-rated");
    }
    if (districtMatches >= DISTRICT_EXPERT_MIN) {
      badges.push("district-expert");
    }

    result[id] = {
      orgId: id,
      badges,
      avgRating,
      ratingCount,
      completedJobs,
      insuranceValid,
      navConfirmed,
      districtMatches,
    };
  }
  return result;
}
