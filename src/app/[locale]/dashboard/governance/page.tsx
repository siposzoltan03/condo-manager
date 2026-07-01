import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { allows } from "@/lib/authz";
import { getDashboardContext } from "@/lib/dal";
import { getGovernanceOverview } from "@/lib/governance-dal";
import { GovernancePanel } from "@/components/governance/governance-panel";

type Props = { params: Promise<{ locale: string }> };

/**
 * Governance / bylaws page — board-only. Shows the current settings and, for
 * users who may modify bylaws, a "propose change" form. Changes are applied
 * only via a passing assembly vote (see proposeBylawsChange / resolveBylawsProposal).
 */
export default async function GovernancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  if (!allows(ctx, "view.boardContext")) {
    redirect(`/${locale}/dashboard`);
  }

  const data = await getGovernanceOverview();
  return <GovernancePanel locale={locale} data={data} />;
}
