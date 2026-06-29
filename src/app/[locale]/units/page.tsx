import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDashboardContext } from "@/lib/dal";
import { allows } from "@/lib/authz";
import { getUnitsOverview } from "@/lib/units-dal";
import { UnitsShell } from "@/components/units/units-shell";
import { UnitsKpiStrip } from "@/components/units/units-kpis";
import { UnitsExplorer } from "@/components/units/units-explorer";
import { UnitsHeaderActions } from "@/components/units/units-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "units.shell" });
  return { title: t("title") };
}

export default async function UnitsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Plan-truth-table contract — Units (lakások) is board-only. Tht.
  // § 16: residents have legal standing over their own lakás, not over
  // the building's full unit register. Direct-URL navigation by
  // OWNER / TENANT is redirected to the dashboard.
  const ctx = await getDashboardContext();
  if (!allows(ctx, "units.manage")) {
    redirect(`/${locale}/dashboard`);
  }

  const data = await getUnitsOverview();
  const t = await getTranslations({ locale, namespace: "units.shell" });

  const subtitle = t("subtitle", {
    building: data.building.name.toUpperCase(),
    city: data.building.city.toUpperCase(),
    time: new Date().toLocaleTimeString("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  return (
    <UnitsShell
      locale={locale}
      totalCount={data.kpis.total}
      subtitle={subtitle}
      headerActions={
        <UnitsHeaderActions isBoardPlus={data.isBoardPlus} />
      }
    >
      <UnitsKpiStrip locale={locale} kpis={data.kpis} />
      <UnitsExplorer
        isBoardPlus={data.isBoardPlus}
        units={data.units}
        floorMap={data.floorMap}
        tabCounts={data.tabCounts}
      />
    </UnitsShell>
  );
}
