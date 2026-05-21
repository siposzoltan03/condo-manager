import type { UnitUser } from "@prisma/client";

/**
 * Phase 5 — Tht. § 22(2) + GDPR Art. 6 contact-consent predicate.
 *
 * Tenants (bérlő) are not members of the condominium under § 16; § 22(2)
 * lets the building retain only the bare minimum (name + presence)
 * unless the tenant explicitly consents to share more. This helper is
 * the single predicate every surface should call before exposing a
 * tenant's phone, email, or other contact channels.
 *
 * For OWNER rows, consent is implicit — § 16 makes them members and
 * the building has a legitimate interest in their contact data.
 *
 * Use:
 *   if (mayExposeContactData(unitUser)) {
 *     return { phone: user.phone, email: user.email };
 *   }
 *   return { phone: null, email: null };
 */
export function mayExposeContactData(
  uu: Pick<UnitUser, "relationship" | "contactConsentAt">,
): boolean {
  if (uu.relationship === "OWNER") return true;
  return uu.contactConsentAt !== null;
}

/**
 * For the resident directory and similar surfaces that aggregate
 * contact data across multiple unit-user rows. Filters down to the
 * subset whose data can be exposed.
 */
export function filterByConsent<T extends Pick<UnitUser, "relationship" | "contactConsentAt">>(
  rows: T[],
): T[] {
  return rows.filter(mayExposeContactData);
}
