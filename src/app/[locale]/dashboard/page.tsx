import { setRequestLocale } from "next-intl/server";
import { DashboardSwitch } from "@/components/dashboard/dashboard-switch";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DashboardSwitch />;
}
