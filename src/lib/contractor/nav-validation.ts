import { checkTaxIdFormat } from "./tax-id";

/**
 * NAV (Hungarian tax authority) adószám validation.
 *
 * The real lookup is `NAV Online Számla — taxpayer query` (SOAP) and
 * needs a technical-user API key issued via Ügyfélkapu. We *can* build
 * that integration but it requires production-grade credentials and is
 * its own workstream — tracked as a Phase 7 follow-up.
 *
 * For Phase 2 we ship a *stub* that:
 *   1. Re-validates the format (defence in depth — even if someone calls
 *      this directly without going through `check-tax-id`).
 *   2. Returns "confirmed" for any well-formed adószám, so onboarding
 *      can be tested end-to-end in dev.
 *
 * The behaviour is gated by `NAV_VALIDATION_MODE`:
 *   - `"stub"` (default in dev): always confirm well-formed ids
 *   - `"manual"`: never confirm — orgs land in PENDING_VERIFICATION and
 *     a platform operator must approve manually
 *   - `"live"`: reserved for the real SOAP integration (not implemented)
 *
 * Production should run `"manual"` or `"live"`; `"stub"` is for dev only.
 */

export type NavValidationOutcome =
  | { confirmed: true; checkedAt: Date; source: "stub" | "manual" | "live" }
  | { confirmed: false; reason: "FORMAT" | "NOT_FOUND" | "ERROR" };

function modeFromEnv(): "stub" | "manual" | "live" {
  const v = process.env.NAV_VALIDATION_MODE;
  if (v === "manual" || v === "live") return v;
  return "stub";
}

export async function validateTaxIdWithNav(
  taxId: string,
): Promise<NavValidationOutcome> {
  const fmt = checkTaxIdFormat(taxId);
  if (!fmt.ok) return { confirmed: false, reason: "FORMAT" };

  const mode = modeFromEnv();

  if (mode === "stub") {
    return { confirmed: true, checkedAt: new Date(), source: "stub" };
  }

  if (mode === "manual") {
    return { confirmed: false, reason: "NOT_FOUND" };
  }

  // "live" — real SOAP integration not implemented yet. We refuse to
  // claim a confirmation in this mode rather than silently faking it.
  // The Phase 7 follow-up will swap this branch for a SOAP call.
  return { confirmed: false, reason: "ERROR" };
}
