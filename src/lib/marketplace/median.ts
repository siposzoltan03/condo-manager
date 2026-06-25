import * as dal from "./dal";
import type { SpecialtySlug } from "@/lib/contractor/taxonomy";

/**
 * Historical bid median, scoped by (specialty, city). Computed from
 * AWARDED + CLOSED publications only — never from in-flight bids.
 *
 * Returns null when the sample is below the threshold: showing a
 * statistically weak median anchors contractors on the wrong number.
 */
const MIN_SAMPLE = 10;

export async function getHistoricalMedian(
  specialty: SpecialtySlug,
  city: string,
): Promise<{ median: number; sampleSize: number } | null> {
  // Pull every awarded/closed publication in this (specialty, city),
  // join its winning bid amount. Done in app code to keep the JSON
  // array-contains check portable.
  const pubs = await dal.findAwardedPublicationsForMedian(city);

  const amounts: number[] = [];
  for (const p of pubs) {
    if (!p.awardedBid) continue;
    const specs = Array.isArray(p.specialties)
      ? (p.specialties as string[])
      : [];
    if (!specs.includes(specialty)) continue;
    amounts.push(Number(p.awardedBid.amount));
  }
  if (amounts.length < MIN_SAMPLE) return null;
  amounts.sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median =
    amounts.length % 2 === 0
      ? (amounts[mid - 1] + amounts[mid]) / 2
      : amounts[mid];
  return { median, sampleSize: amounts.length };
}
