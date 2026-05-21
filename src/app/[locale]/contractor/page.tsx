import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ContractorLanding } from "@/components/contractor/contractor-landing";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Public marketing landing page for the contractor marketplace. Anyone
 * can view it. Already-authenticated contractors get bounced to their
 * marketplace home so they don't see the marketing surface twice.
 */
export default async function ContractorRootPage({ params }: PageProps) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user?.kind === "contractor") {
    redirect(`/${locale}/contractor/marketplace`);
  }
  return <ContractorLanding locale={locale as "hu" | "en"} />;
}
