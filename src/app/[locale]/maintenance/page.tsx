import { setRequestLocale } from "next-intl/server";
import { TicketList } from "@/components/maintenance/TicketList";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MaintenancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TicketList />
    </div>
  );
}
