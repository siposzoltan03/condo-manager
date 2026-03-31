import { setRequestLocale } from "next-intl/server";
import { CheckoutRedirect } from "@/components/public/checkout-redirect";

type Props = {
  params: Promise<{ locale: string; planSlug: string }>;
};

export default async function CheckoutPage({ params }: Props) {
  const { locale, planSlug } = await params;
  setRequestLocale(locale);

  return <CheckoutRedirect planSlug={planSlug} />;
}
