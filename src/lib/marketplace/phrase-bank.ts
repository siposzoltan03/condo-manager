/**
 * Templated Hungarian phrase fragments used to construct the best-fit
 * rationale sentence. Each (factor, bin) → fragment. Copy edits go
 * here — never in product code.
 *
 * Bins are descriptive buckets, not score thresholds: "above" /
 * "near" / "below". The ranker classifies its computed value into the
 * right bin and looks up the fragment.
 */

export type FactorKey =
  | "price"
  | "rating"
  | "completed"
  | "responseTime"
  | "districtMatch"
  | "etaUrgency"
  | "verification";

export type Bin = "above" | "near" | "below" | "missing";

interface PhraseEntry {
  hu: string;
  en: string;
}

export const PHRASE_BANK: Record<FactorKey, Partial<Record<Bin, PhraseEntry>>> = {
  price: {
    above: { hu: "Ár a sáv felett", en: "Price above the median" },
    near: { hu: "Ár a sáv közepén", en: "Price near the median" },
    below: { hu: "Ár a sáv alatt", en: "Price below the median" },
    missing: { hu: "Nincs ár-referencia", en: "No price reference" },
  },
  rating: {
    above: { hu: "Magas értékelés", en: "Strong rating" },
    near: { hu: "Megbízható értékelés", en: "Solid rating" },
    below: { hu: "Vegyes értékelés", en: "Mixed rating" },
    missing: { hu: "Még nincs értékelés", en: "Unrated yet" },
  },
  completed: {
    above: { hu: "Sok lezárt munka", en: "Many completed jobs" },
    near: { hu: "Több lezárt munka", en: "Multiple completed jobs" },
    below: { hu: "Friss a piacon", en: "New on marketplace" },
  },
  responseTime: {
    above: { hu: "Gyors válaszadó", en: "Fast responder" },
    near: { hu: "Megszokott válaszidő", en: "Average response time" },
    below: { hu: "Lassabb válaszidő", en: "Slower response time" },
    missing: { hu: "Még nincs válaszidő-adat", en: "No response data" },
  },
  districtMatch: {
    above: { hu: "Kerületi szakértelem", en: "District expert" },
    near: { hu: "Helyismeretes", en: "Local familiarity" },
    below: { hu: "Új a kerületben", en: "New to the district" },
  },
  etaUrgency: {
    above: { hu: "ETA átlag alatt", en: "ETA below average" },
    near: { hu: "ETA az elvárthoz illik", en: "ETA matches the urgency" },
    below: { hu: "ETA kicsit tág", en: "ETA looser than ideal" },
  },
  verification: {
    above: {
      hu: "NAV + biztosítás rendben",
      en: "NAV + insurance verified",
    },
    near: { hu: "NAV igazolva", en: "NAV verified" },
    below: {
      hu: "Hiányos verifikáció",
      en: "Incomplete verification",
    },
  },
};

export function phraseFor(
  factor: FactorKey,
  bin: Bin,
  locale: "hu" | "en",
): string {
  const entry = PHRASE_BANK[factor][bin];
  if (!entry) return "";
  return locale === "en" ? entry.en : entry.hu;
}
