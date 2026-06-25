/**
 * Hungarian adószám (tax ID) format validation.
 *
 * Format: `XXXXXXXX-Y-ZZ`
 *   - 8 digits (the body)
 *   - 1 digit Y (tax type, 1–5)
 *   - 2 digits ZZ (regional code; 01–44 + 51)
 *
 * Pass-through utilities. NAV's real online validation service requires
 * SOAP + an API key issued via Ügyfélkapu. Phase 1 only checks the
 * format; the inline UI calls `checkTaxIdFormat()` and Phase 2's
 * onboarding flow will swap this for the real NAV call.
 */

const FORMAT_RE = /^(\d{8})-([1-5])-(\d{2})$/;
const VALID_REGION_CODES = new Set<string>([
  ...Array.from({ length: 44 }, (_, i) => String(i + 1).padStart(2, "0")),
  "51",
]);

export type TaxIdCheck =
  | { ok: true; normalized: string }
  | { ok: false; reason: "FORMAT" | "REGION" };

export function checkTaxIdFormat(input: string): TaxIdCheck {
  const trimmed = input.trim();
  const m = trimmed.match(FORMAT_RE);
  if (!m) return { ok: false, reason: "FORMAT" };
  const region = m[3];
  if (!VALID_REGION_CODES.has(region)) {
    return { ok: false, reason: "REGION" };
  }
  return { ok: true, normalized: `${m[1]}-${m[2]}-${m[3]}` };
}
