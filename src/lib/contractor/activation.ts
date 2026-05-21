import { sendEmail } from "@/lib/email";
import { contractorWelcomeEmail } from "@/lib/email-templates";
import {
  getOrgForReadiness,
  getOrgForActivation,
  setOrgStatusActive,
} from "./dal";

/**
 * The set of preconditions a contractor org must satisfy before we flip
 * `status` from `PENDING_VERIFICATION` to `ACTIVE`.
 *
 *   - `navConfirmedAt`  — tax id confirmed by NAV (or stub in dev)
 *   - `dpaSignedAt`     — operator accepted DPA + ToS at the review step
 *   - `documents`       — at least one document of kind="insurance" AND
 *                         one of kind="license" uploaded
 *   - `specialties.length >= 1`
 *   - `regions.length >= 1`
 *
 * Anything missing keeps the org in PENDING_VERIFICATION; the wizard
 * surface walks the user back to whichever step is incomplete.
 */
export interface ActivationReadiness {
  ready: boolean;
  missing: {
    nav: boolean;
    dpa: boolean;
    insuranceDoc: boolean;
    licenseDoc: boolean;
    specialty: boolean;
    region: boolean;
  };
}

export async function evaluateReadiness(
  orgId: string,
): Promise<ActivationReadiness> {
  const org = await getOrgForReadiness(orgId);
  if (!org) {
    return {
      ready: false,
      missing: {
        nav: true,
        dpa: true,
        insuranceDoc: true,
        licenseDoc: true,
        specialty: true,
        region: true,
      },
    };
  }

  const kinds = new Set(org.documents.map((d) => d.kind));
  const specialties = Array.isArray(org.specialties) ? org.specialties : [];
  const regions = Array.isArray(org.regions) ? org.regions : [];

  const missing = {
    nav: !org.navConfirmedAt,
    dpa: !org.dpaSignedAt,
    insuranceDoc: !kinds.has("insurance"),
    licenseDoc: !kinds.has("license"),
    specialty: specialties.length === 0,
    region: regions.length === 0,
  };
  const ready = !Object.values(missing).some(Boolean);
  return { ready, missing };
}

/**
 * Flips the org to ACTIVE iff `evaluateReadiness` returns ready=true.
 * Best-effort welcome email — failure is logged but does not roll back
 * the activation (the user can sign in either way).
 *
 * Idempotent: re-calling on an already-ACTIVE org is a no-op.
 */
export async function tryActivate(
  orgId: string,
  loginUrl: string,
  locale: "hu" | "en" = "hu",
): Promise<{ activated: boolean; reason?: string }> {
  const readiness = await evaluateReadiness(orgId);
  if (!readiness.ready) {
    const firstMissing = Object.entries(readiness.missing).find(
      ([, v]) => v,
    )?.[0];
    return { activated: false, reason: firstMissing };
  }

  const current = await getOrgForActivation(orgId);
  if (!current) return { activated: false, reason: "not-found" };
  if (current.status === "ACTIVE") return { activated: true };

  await setOrgStatusActive(orgId);

  const owner = current.users[0];
  if (owner) {
    const { subject, html } = contractorWelcomeEmail({
      recipientName: owner.name,
      orgName: current.name,
      loginLink: loginUrl,
      locale,
    });
    sendEmail(owner.email, subject, html).catch((err) => {
      console.error("Contractor welcome email failed:", err);
    });
  }

  return { activated: true };
}
