import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CheckoutSuccess } from "@/components/public/checkout-success";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { session_id } = await searchParams;
  setRequestLocale(locale);

  if (!session_id) {
    redirect(`/${locale}/pricing`);
  }

  return <CheckoutSuccess />;
}
