import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgForBillingPage } from "@/lib/contractor";
import {
  getEffectivePlan,
  countActiveBidsByOrgSince,
} from "@/lib/marketplace";
import { ContractorBillingPage } from "@/components/contractor/billing-page";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ContractorBillingRoute({ params }: PageProps) {
  const { locale } = await params;
  const session = await auth();
  const orgId = session?.user?.contractorOrgId;
  if (!session?.user || !orgId) {
    redirect(`/${locale}/contractor/login`);
  }
  const org = await getOrgForBillingPage(orgId);
  if (!org) redirect(`/${locale}/contractor/login`);
  if (org.status === "PENDING_VERIFICATION") {
    redirect(`/${locale}/contractor/onboarding`);
  }

  const effective = await getEffectivePlan(orgId);
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

  // Usage stats — bids submitted in trailing 7 days + specialty/region counts.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const bidsLast7Days = await countActiveBidsByOrgSince(orgId, since);
  const specialtyCount = Array.isArray(org.specialties)
    ? (org.specialties as unknown[]).length
    : 0;
  const regionCount = Array.isArray(org.regions)
    ? (org.regions as unknown[]).length
    : 0;

  return (
    <ContractorBillingPage
      locale={locale as "hu" | "en"}
      plan={effective.plan}
      status={effective.status}
      trialDaysRemaining={effective.trialDaysRemaining}
      currentPeriodEndsAt={
        org.currentPeriodEndsAt ? org.currentPeriodEndsAt.toISOString() : null
      }
      stripeConfigured={stripeConfigured}
      usage={{
        bidsLast7Days,
        specialtyCount,
        regionCount,
      }}
    />
  );
}
