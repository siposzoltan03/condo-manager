import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgStatus } from "@/lib/contractor";
import { MarketplaceBoard } from "@/components/contractor/marketplace-board";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Contractor-side marketplace board. Lists OPEN publications that
 * intersect the org's specialties. Filtering happens client-side via
 * the API; this server component just gates access.
 */
export default async function ContractorMarketplacePage({ params }: PageProps) {
  const { locale } = await params;
  const session = await auth();
  const orgId = session?.user?.contractorOrgId;
  if (!session?.user || !orgId) {
    redirect(`/${locale}/contractor/login`);
  }

  const org = await getOrgStatus(orgId);
  if (!org) redirect(`/${locale}/contractor/login`);
  if (org.status === "PENDING_VERIFICATION") {
    redirect(`/${locale}/contractor/onboarding`);
  }

  return <MarketplaceBoard locale={locale as "hu" | "en"} />;
}
