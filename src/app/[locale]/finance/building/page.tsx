import { setRequestLocale } from "next-intl/server";
import { BuildingFinanceOverview } from "@/components/finance/building-finance-overview";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BuildingFinancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <BuildingFinanceOverview />
    </div>
  );
}
