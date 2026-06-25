import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getResidentsOverview } from "@/lib/residents-dal";
import { getUnitsOverview } from "@/lib/units-dal";
import { ResidentsShell } from "@/components/residents/residents-shell";
import { ResidentsExplorer } from "@/components/residents/residents-explorer";
import { ResidentsHeaderActions } from "@/components/residents/residents-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "residents.shell" });
  return { title: t("title") };
}

export default async function ResidentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [data, units] = await Promise.all([
    getResidentsOverview(),
    getUnitsOverview(),
  ]);
  const t = await getTranslations({ locale, namespace: "residents.shell" });

  const ownersCount = data.tabCounts.owners;
  const tenantsCount = data.tabCounts.tenants;
  const householdsCount = ownersCount + tenantsCount;
  const subtitle = t("subtitle", {
    households: householdsCount.toString(),
    people: data.totalCount.toString(),
  });

  return (
    <ResidentsShell
      locale={locale}
      totalCount={data.totalCount}
      subtitle={subtitle}
      headerActions={
        <ResidentsHeaderActions
          isBoardPlus={data.isBoardPlus}
          units={units.units.map((u) => ({
            id: u.id,
            number: u.number,
            stairwell: u.stairwell,
          }))}
        />
      }
    >
      <ResidentsExplorer
        isBoardPlus={data.isBoardPlus}
        isAdmin={data.isAdmin}
        groups={data.groups}
        distribution={data.distribution}
        tabCounts={data.tabCounts}
      />
    </ResidentsShell>
  );
}
