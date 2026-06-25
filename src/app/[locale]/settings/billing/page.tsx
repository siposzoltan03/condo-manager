import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getBillingData } from "@/lib/dal";
import { BillingPage } from "@/components/settings/billing-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });
  return { title: t("title") };
}

export default async function BillingSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getBillingData();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <BillingPage initialData={data} />
    </div>
  );
}
