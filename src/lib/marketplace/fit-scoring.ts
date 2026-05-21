import * as dal from "./dal";
import { phraseFor, type Bin, type FactorKey } from "./phrase-bank";

/**
 * Deterministic, rule-based best-fit ranker. **No LLM. No external ML
 * service.** Same inputs → same score, always.
 *
 * Public copy may say "Közös AI · best-fit" for marketing reasons, but
 * the engineering is a documented weighted sum on first-party data,
 * version-tagged so each award decision is reproducible months later
 * even after weights are re-tuned (P2B Reg Art. 5 transparency).
 *
 * Composite is 0–100, distributed across 7 factors:
 *   25 — Price position vs band median (closer to median = higher)
 *   20 — Past rating average
 *   15 — Lezárt munka count (log-scaled, saturates ~50)
 *   15 — Median response time
 *   10 — District / city specificity
 *   10 — ETA vs publication urgency
 *    5 — Verification freshness (NAV + insurance)
 */

export const WEIGHTS_VERSION = "v1.0.0";

const WEIGHTS = {
  price: 25,
  rating: 20,
  completed: 15,
  responseTime: 15,
  districtMatch: 10,
  etaUrgency: 10,
  verification: 5,
} as const satisfies Record<FactorKey, number>;

/** Raw factor values that go into the cached snapshot. */
export interface FactorSnapshot {
  // 0..1 normalised contribution before weighting; product is points.
  priceNorm: number;
  ratingNorm: number;
  completedNorm: number;
  responseTimeNorm: number;
  districtMatchNorm: number;
  etaUrgencyNorm: number;
  verificationNorm: number;
  // Raw values kept around for the rationale + audit trail.
  raw: {
    bidAmount: number;
    medianAmount: number | null;
    avgRating: number | null;
    ratingCount: number;
    completedJobs: number;
    districtMatches: number;
    etaDays: number;
    urgencyTargetDays: number;
    navConfirmed: boolean;
    insuranceValid: boolean;
  };
}

export interface FitScore {
  bidId: string;
  score: number;
  rationale: string;
  weightsVersion: string;
  factors: FactorSnapshot;
}

interface InputBid {
  id: string;
  amount: number;
  etaDays: number;
  bidder: {
    id: string;
    navConfirmedAt: Date | null;
  };
}

interface InputPublication {
  id: string;
  city: string;
  zip: string;
  urgency: string;
  specialties: string[];
}

/**
 * Compute scores for every bid on a publication. Results are upserted
 * into `MarketplaceFitScore` so the rationale + factor snapshot is
 * persistent and reproducible.
 */
export async function computeFitScores(
  publication: InputPublication,
  bids: InputBid[],
  locale: "hu" | "en" = "hu",
): Promise<FitScore[]> {
  const orgIds = bids.map((b) => b.bidder.id);
  const ctx = await loadOrgContext(orgIds, publication);

  // Price reference — median of all submitted bids on this publication.
  const amounts = bids.map((b) => b.amount).sort((a, b) => a - b);
  const medianAmount = medianOf(amounts);
  const urgencyTargetDays = urgencyToDays(publication.urgency);

  const scores: FitScore[] = bids.map((b) => {
    const c = ctx[b.bidder.id];

    // Each factor returns a 0..1 normalised contribution.
    const priceNorm = priceFactor(b.amount, medianAmount);
    const ratingNorm = ratingFactor(c.avgRating, c.ratingCount);
    const completedNorm = completedFactor(c.completedJobs);
    const responseTimeNorm = c.responseTimeNorm;
    const districtMatchNorm = districtFactor(c.districtMatches);
    const etaUrgencyNorm = etaUrgencyFactor(b.etaDays, urgencyTargetDays);
    const verificationNorm = verificationFactor(
      !!b.bidder.navConfirmedAt,
      c.insuranceValid,
    );

    const score =
      Math.round(
        priceNorm * WEIGHTS.price +
          ratingNorm * WEIGHTS.rating +
          completedNorm * WEIGHTS.completed +
          responseTimeNorm * WEIGHTS.responseTime +
          districtMatchNorm * WEIGHTS.districtMatch +
          etaUrgencyNorm * WEIGHTS.etaUrgency +
          verificationNorm * WEIGHTS.verification,
      );

    const factors: FactorSnapshot = {
      priceNorm,
      ratingNorm,
      completedNorm,
      responseTimeNorm,
      districtMatchNorm,
      etaUrgencyNorm,
      verificationNorm,
      raw: {
        bidAmount: b.amount,
        medianAmount,
        avgRating: c.avgRating,
        ratingCount: c.ratingCount,
        completedJobs: c.completedJobs,
        districtMatches: c.districtMatches,
        etaDays: b.etaDays,
        urgencyTargetDays,
        navConfirmed: !!b.bidder.navConfirmedAt,
        insuranceValid: c.insuranceValid,
      },
    };

    const rationale = buildRationale(factors, locale);

    return { bidId: b.id, score, rationale, weightsVersion: WEIGHTS_VERSION, factors };
  });

  // Persist asynchronously — failure is non-fatal; the UI already has
  // the score in-memory.
  Promise.all(
    scores.map((s) =>
      dal.upsertFitScore({
        bidId: s.bidId,
        publicationId: publication.id,
        score: s.score,
        rationale: s.rationale,
        weightsVersion: s.weightsVersion,
        factorsJson: JSON.parse(JSON.stringify(s.factors)),
      }),
    ),
  ).catch((err) => console.error("FitScore upsert failed:", err));

  return scores;
}

// ── Per-org context ───────────────────────────────────────────────────────

interface OrgContext {
  avgRating: number | null;
  ratingCount: number;
  completedJobs: number;
  districtMatches: number;
  responseTimeNorm: number;
  insuranceValid: boolean;
}

async function loadOrgContext(
  orgIds: string[],
  publication: InputPublication,
): Promise<Record<string, OrgContext>> {
  if (orgIds.length === 0) return {};

  const [ratings, completed, docs] = await Promise.all([
    dal.findRatingsForOrgs(orgIds),
    dal.findCompletedTicketsForOrgs(orgIds),
    dal.findInsuranceDocsForOrgs(orgIds),
  ]);

  const result: Record<string, OrgContext> = {};
  for (const id of orgIds) {
    const rArr = ratings.filter((r) => r.contractorOrgId === id);
    const avgRating =
      rArr.length > 0
        ? rArr.reduce((s, r) => s + r.rating, 0) / rArr.length
        : null;

    const cArr = completed.filter((c) => c.awardedContractorId === id);
    const dArr = docs.filter((d) => d.orgId === id);

    const districtMatches = cArr.filter(
      (c) => c.building.city === publication.city,
    ).length;

    const insuranceValid = dArr.some(
      (d) => !d.validUntil || d.validUntil.getTime() > Date.now(),
    );

    result[id] = {
      avgRating,
      ratingCount: rArr.length,
      completedJobs: cArr.length,
      districtMatches,
      // Response-time tracking lands in a follow-up — neutral 0.5 for now.
      responseTimeNorm: 0.5,
      insuranceValid,
    };
  }
  return result;
}

// ── Factor functions ──────────────────────────────────────────────────────

/**
 * Bell-shape around the median: closest to median scores highest. A
 * lowest-price bid doesn't auto-win — "too cheap" is a quality signal.
 * With no median (no other bids), we return a neutral 0.5.
 */
function priceFactor(bidAmount: number, medianAmount: number | null): number {
  if (!medianAmount || medianAmount <= 0) return 0.5;
  const ratio = bidAmount / medianAmount;
  const distance = Math.abs(ratio - 1);
  return clamp01(1 - distance);
}

function ratingFactor(avg: number | null, count: number): number {
  if (!avg || count === 0) return 0.4; // mild penalty for unrated
  // 5★ → 1.0, 1★ → 0.0
  const normalised = (avg - 1) / 4;
  // Bayesian-ish dampening: low count → drag back toward 0.5
  const confidence = Math.min(1, count / 10);
  return clamp01(0.5 + confidence * (normalised - 0.5));
}

function completedFactor(count: number): number {
  // log-scaled, saturates ~50
  if (count <= 0) return 0;
  return clamp01(Math.log(count + 1) / Math.log(51));
}

function districtFactor(matches: number): number {
  // 3+ awarded jobs in the same city ⇒ "kerületi szakértő" (1.0)
  if (matches >= 3) return 1;
  if (matches === 2) return 0.66;
  if (matches === 1) return 0.33;
  return 0;
}

function etaUrgencyFactor(etaDays: number, targetDays: number): number {
  if (targetDays <= 0) return 0.5;
  if (etaDays <= targetDays) return 1;
  // Linearly degrade out to 2× target.
  const ratio = etaDays / targetDays;
  return clamp01(1 - (ratio - 1));
}

function verificationFactor(nav: boolean, insurance: boolean): number {
  let v = 0;
  if (nav) v += 0.5;
  if (insurance) v += 0.5;
  return v;
}

// ── Rationale builder ─────────────────────────────────────────────────────

function buildRationale(f: FactorSnapshot, locale: "hu" | "en"): string {
  const items: Array<{ factor: FactorKey; bin: Bin; contribution: number }> = [
    {
      factor: "price",
      bin: binForPrice(f.raw.bidAmount, f.raw.medianAmount),
      contribution: f.priceNorm * WEIGHTS.price,
    },
    {
      factor: "rating",
      bin: binForRating(f.raw.avgRating, f.raw.ratingCount),
      contribution: f.ratingNorm * WEIGHTS.rating,
    },
    {
      factor: "completed",
      bin: binForCompleted(f.raw.completedJobs),
      contribution: f.completedNorm * WEIGHTS.completed,
    },
    {
      factor: "responseTime",
      bin: "missing",
      contribution: f.responseTimeNorm * WEIGHTS.responseTime,
    },
    {
      factor: "districtMatch",
      bin: binForDistrict(f.raw.districtMatches),
      contribution: f.districtMatchNorm * WEIGHTS.districtMatch,
    },
    {
      factor: "etaUrgency",
      bin: binForEta(f.raw.etaDays, f.raw.urgencyTargetDays),
      contribution: f.etaUrgencyNorm * WEIGHTS.etaUrgency,
    },
    {
      factor: "verification",
      bin: binForVerification(f.raw.navConfirmed, f.raw.insuranceValid),
      contribution: f.verificationNorm * WEIGHTS.verification,
    },
  ];

  // Pick the top-3 by contribution; skip empties.
  const top = items
    .filter((i) => i.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  const phrases = top
    .map((i) => phraseFor(i.factor, i.bin, locale))
    .filter(Boolean);

  if (phrases.length === 0) {
    return locale === "en"
      ? "Standard fit — no standout signal yet."
      : "Átlagos illeszkedés — még nincs kiugró jel.";
  }
  return phrases.join(" · ");
}

// ── Bin classifiers ───────────────────────────────────────────────────────

function binForPrice(bid: number, median: number | null): Bin {
  if (!median) return "missing";
  const ratio = bid / median;
  if (Math.abs(ratio - 1) < 0.08) return "near";
  return ratio < 1 ? "below" : "above";
}

function binForRating(avg: number | null, count: number): Bin {
  if (!avg || count === 0) return "missing";
  if (avg >= 4.5) return "above";
  if (avg >= 3.5) return "near";
  return "below";
}

function binForCompleted(count: number): Bin {
  if (count >= 10) return "above";
  if (count >= 3) return "near";
  return "below";
}

function binForDistrict(matches: number): Bin {
  if (matches >= 3) return "above";
  if (matches >= 1) return "near";
  return "below";
}

function binForEta(etaDays: number, targetDays: number): Bin {
  if (targetDays <= 0) return "near";
  if (etaDays <= targetDays * 0.6) return "above";
  if (etaDays <= targetDays) return "near";
  return "below";
}

function binForVerification(nav: boolean, insurance: boolean): Bin {
  if (nav && insurance) return "above";
  if (nav) return "near";
  return "below";
}

// ── Helpers ───────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function medianOf(sortedAmounts: number[]): number | null {
  if (sortedAmounts.length === 0) return null;
  const mid = Math.floor(sortedAmounts.length / 2);
  return sortedAmounts.length % 2 === 0
    ? (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2
    : sortedAmounts[mid];
}

function urgencyToDays(urgency: string): number {
  switch (urgency) {
    case "URGENT":
      return 2;
    case "MEDIUM":
      return 14;
    case "PLANNED":
      return 60;
    default:
      return 14;
  }
}
