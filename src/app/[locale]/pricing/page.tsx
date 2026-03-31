import { setRequestLocale } from "next-intl/server";
import { PricingPage } from "@/components/public/pricing-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PricingRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PricingPage />;
}
