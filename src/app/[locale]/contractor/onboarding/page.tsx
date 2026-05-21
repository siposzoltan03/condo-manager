import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgStatus } from "@/lib/contractor";
import { OnboardingWizard } from "@/components/contractor/onboarding-wizard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Single-page wizard for contractor onboarding. Renders only after the
 * email is verified — the auth provider blocks login otherwise — so we
 * don't need a second gate here. ACTIVE orgs are bounced to the
 * marketplace so the wizard isn't accessible after activation.
 *
 * Reads status fresh from the DB; the JWT status snapshot is stale
 * immediately after `finalize`.
 */
export default async function ContractorOnboardingPage({ params }: PageProps) {
  const { locale } = await params;
  const session = await auth();
  const u = session?.user;
  if (!u || u.kind !== "contractor" || !u.contractorOrgId) {
    redirect(`/${locale}/contractor/login`);
  }

  const org = await getOrgStatus(u.contractorOrgId);
  if (org?.status === "ACTIVE") {
    redirect(`/${locale}/contractor/marketplace`);
  }

  return <OnboardingWizard locale={locale as "hu" | "en"} />;
}
