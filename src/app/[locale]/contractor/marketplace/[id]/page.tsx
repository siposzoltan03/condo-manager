import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgStatus } from "@/lib/contractor";
import { findContractorWonBidForPublication } from "@/lib/marketplace";
import { PublicationDetail } from "@/components/contractor/publication-detail";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ContractorPublicationDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
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

  // If the listing is no longer open and this contractor won it,
  // skip the dead-end and send them straight to their project view.
  const wonBid = await findContractorWonBidForPublication(id, orgId);
  if (wonBid) {
    redirect(`/${locale}/contractor/projects/${wonBid.id}`);
  }

  return (
    <PublicationDetail
      locale={locale as "hu" | "en"}
      publicationId={id}
      currentOrgId={orgId}
    />
  );
}
