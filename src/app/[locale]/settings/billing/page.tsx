import { setRequestLocale } from "next-intl/server";
import { BillingPage } from "@/components/settings/billing-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BillingSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <BillingPage />
    </div>
  );
}
