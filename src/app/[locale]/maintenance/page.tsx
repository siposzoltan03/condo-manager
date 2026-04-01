import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getTickets } from "@/lib/dal";
import { TicketList } from "@/components/maintenance/TicketList";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance" });
  return { title: t("title") };
}

export default async function MaintenancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getTickets();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TicketList initialData={data} />
    </div>
  );
}
