import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { FinanceOverview } from "@/components/finance/finance-overview";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "finance" });
  return { title: t("title") };
}

export default async function FinancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { role } = await requireBuildingContext();
  const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FinanceOverview isBoardPlus={isBoardPlus} />
    </div>
  );
}
