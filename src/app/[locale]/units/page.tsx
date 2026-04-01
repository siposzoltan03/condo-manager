import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getUnits } from "@/lib/dal";
import { UnitList } from "@/components/units/unit-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "units" });
  return { title: t("title") };
}

export default async function UnitsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getUnits();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <UnitList initialData={data} />
    </div>
  );
}
