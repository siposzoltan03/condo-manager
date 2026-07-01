import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { allows } from "@/lib/authz";
import { getDashboardContext } from "@/lib/dal";
import { BuildingOnboardingWizard } from "@/components/onboarding/building-onboarding-wizard";

type Props = { params: Promise<{ locale: string }> };

/**
 * Building onboarding wizard — board-only. Guides setup across basics,
 * governance, units, SZMSZ and invites, then records completion. Non-gating:
 * the board can leave and resume at any time (state is derived from the data).
 */
export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  if (!allows(ctx, "board.manage")) {
    redirect(`/${locale}/dashboard`);
  }

  return <BuildingOnboardingWizard locale={locale} />;
}
