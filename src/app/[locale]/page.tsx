import { setRequestLocale } from "next-intl/server";
import { LandingPageWrapper } from "@/components/public/landing-page-wrapper";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LandingPageWrapper />;
}
