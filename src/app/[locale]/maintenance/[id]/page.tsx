import { setRequestLocale } from "next-intl/server";
import { TicketDetail } from "@/components/maintenance/TicketDetail";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function TicketDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TicketDetail ticketId={id} />
    </div>
  );
}
