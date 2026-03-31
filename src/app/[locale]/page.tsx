import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/public/landing-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();

  // Authenticated users go straight to dashboard
  if (session?.user) {
    redirect(`/${locale}/dashboard`);
  }

  // Unauthenticated users see the marketing landing page
  return <LandingPage />;
}
