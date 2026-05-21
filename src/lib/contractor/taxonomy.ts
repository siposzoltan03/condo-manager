/**
 * Fixed taxonomies for the contractor marketplace.
 *
 * Specialties = the work a contractor can bid on.
 * Regions     = the geography they'll travel to.
 *
 * Both are stored as `Json` arrays of slugs on `ContractorOrg`, and
 * matched against `MarketplacePublication.specialty` / `regionCode` in
 * the Phase 5 ranker. Slugs are the only persisted form; labels live
 * here so renaming a label never breaks stored data.
 */

export type SpecialtySlug = (typeof SPECIALTIES)[number]["slug"];
export type RegionCode = (typeof REGIONS)[number]["code"];

export const SPECIALTIES = [
  { slug: "plumbing", hu: "Vízvezeték-szerelés", en: "Plumbing" },
  { slug: "electrical", hu: "Villanyszerelés", en: "Electrical" },
  { slug: "heating", hu: "Fűtés / kazán", en: "Heating / boiler" },
  { slug: "elevator", hu: "Lift karbantartás", en: "Elevator maintenance" },
  { slug: "roofing", hu: "Tetőfedés / bádogos", en: "Roofing" },
  { slug: "facade", hu: "Homlokzat / festés", en: "Facade / painting" },
  { slug: "carpentry", hu: "Asztalos / faszerkezet", en: "Carpentry" },
  { slug: "locksmith", hu: "Lakatos / zárszerelés", en: "Locksmith" },
  { slug: "garden", hu: "Kert / zöldfelület", en: "Garden / landscaping" },
  { slug: "cleaning", hu: "Takarítás", en: "Cleaning" },
  { slug: "pest-control", hu: "Rovar- és rágcsálóirtás", en: "Pest control" },
  { slug: "security", hu: "Biztonságtechnika", en: "Security" },
  { slug: "other", hu: "Egyéb", en: "Other" },
] as const;

/**
 * Hungarian county codes (Vármegye) — ISO 3166-2:HU short forms — plus
 * Budapest split into 23 districts so a contractor licensed only in
 * district VII doesn't have to claim "all of Budapest". The "PE" Pest
 * vármegye is kept separate from Budapest districts.
 */
export const REGIONS = [
  // Budapest districts
  { code: "BP-01", hu: "Budapest I. ker.", en: "Budapest district I" },
  { code: "BP-02", hu: "Budapest II. ker.", en: "Budapest district II" },
  { code: "BP-03", hu: "Budapest III. ker.", en: "Budapest district III" },
  { code: "BP-04", hu: "Budapest IV. ker.", en: "Budapest district IV" },
  { code: "BP-05", hu: "Budapest V. ker.", en: "Budapest district V" },
  { code: "BP-06", hu: "Budapest VI. ker.", en: "Budapest district VI" },
  { code: "BP-07", hu: "Budapest VII. ker.", en: "Budapest district VII" },
  { code: "BP-08", hu: "Budapest VIII. ker.", en: "Budapest district VIII" },
  { code: "BP-09", hu: "Budapest IX. ker.", en: "Budapest district IX" },
  { code: "BP-10", hu: "Budapest X. ker.", en: "Budapest district X" },
  { code: "BP-11", hu: "Budapest XI. ker.", en: "Budapest district XI" },
  { code: "BP-12", hu: "Budapest XII. ker.", en: "Budapest district XII" },
  { code: "BP-13", hu: "Budapest XIII. ker.", en: "Budapest district XIII" },
  { code: "BP-14", hu: "Budapest XIV. ker.", en: "Budapest district XIV" },
  { code: "BP-15", hu: "Budapest XV. ker.", en: "Budapest district XV" },
  { code: "BP-16", hu: "Budapest XVI. ker.", en: "Budapest district XVI" },
  { code: "BP-17", hu: "Budapest XVII. ker.", en: "Budapest district XVII" },
  { code: "BP-18", hu: "Budapest XVIII. ker.", en: "Budapest district XVIII" },
  { code: "BP-19", hu: "Budapest XIX. ker.", en: "Budapest district XIX" },
  { code: "BP-20", hu: "Budapest XX. ker.", en: "Budapest district XX" },
  { code: "BP-21", hu: "Budapest XXI. ker.", en: "Budapest district XXI" },
  { code: "BP-22", hu: "Budapest XXII. ker.", en: "Budapest district XXII" },
  { code: "BP-23", hu: "Budapest XXIII. ker.", en: "Budapest district XXIII" },
  // 19 vármegyék (HU counties)
  { code: "BA", hu: "Baranya", en: "Baranya" },
  { code: "BK", hu: "Bács-Kiskun", en: "Bács-Kiskun" },
  { code: "BE", hu: "Békés", en: "Békés" },
  { code: "BZ", hu: "Borsod-Abaúj-Zemplén", en: "Borsod-Abaúj-Zemplén" },
  { code: "CS", hu: "Csongrád-Csanád", en: "Csongrád-Csanád" },
  { code: "FE", hu: "Fejér", en: "Fejér" },
  { code: "GS", hu: "Győr-Moson-Sopron", en: "Győr-Moson-Sopron" },
  { code: "HB", hu: "Hajdú-Bihar", en: "Hajdú-Bihar" },
  { code: "HE", hu: "Heves", en: "Heves" },
  { code: "JN", hu: "Jász-Nagykun-Szolnok", en: "Jász-Nagykun-Szolnok" },
  { code: "KE", hu: "Komárom-Esztergom", en: "Komárom-Esztergom" },
  { code: "NO", hu: "Nógrád", en: "Nógrád" },
  { code: "PE", hu: "Pest", en: "Pest" },
  { code: "SO", hu: "Somogy", en: "Somogy" },
  { code: "SZ", hu: "Szabolcs-Szatmár-Bereg", en: "Szabolcs-Szatmár-Bereg" },
  { code: "TO", hu: "Tolna", en: "Tolna" },
  { code: "VA", hu: "Vas", en: "Vas" },
  { code: "VE", hu: "Veszprém", en: "Veszprém" },
  { code: "ZA", hu: "Zala", en: "Zala" },
] as const;

const SPECIALTY_SLUGS = new Set(SPECIALTIES.map((s) => s.slug));
const REGION_CODES = new Set(REGIONS.map((r) => r.code));

export function isSpecialtySlug(s: unknown): s is SpecialtySlug {
  return typeof s === "string" && SPECIALTY_SLUGS.has(s as SpecialtySlug);
}

export function isRegionCode(s: unknown): s is RegionCode {
  return typeof s === "string" && REGION_CODES.has(s as RegionCode);
}

/** Filter + de-duplicate a user-supplied list to known slugs only. */
export function sanitizeSpecialties(input: unknown): SpecialtySlug[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter(isSpecialtySlug)));
}

export function sanitizeRegions(input: unknown): RegionCode[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter(isRegionCode)));
}

export function specialtyLabel(slug: string, locale: "hu" | "en"): string {
  const found = SPECIALTIES.find((s) => s.slug === slug);
  if (!found) return slug;
  return locale === "en" ? found.en : found.hu;
}

export function regionLabel(code: string, locale: "hu" | "en"): string {
  const found = REGIONS.find((r) => r.code === code);
  if (!found) return code;
  return locale === "en" ? found.en : found.hu;
}
