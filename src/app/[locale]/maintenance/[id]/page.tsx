import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getTicketDetail } from "@/lib/maintenance-dal";
import { TicketDetailView } from "@/components/maintenance/ticket-detail-view";
import { getInvoiceForTicketPublication } from "@/lib/marketplace";
import type { BoardInvoiceDTO } from "@/components/maintenance/board-project-invoice";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance" });
  return { title: t("ticketDetail") };
}

export default async function TicketDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ticket = await getTicketDetail(id);
  if (!ticket) notFound();

  // If this ticket was awarded through the marketplace and the contractor
  // submitted an invoice, surface it to the board next to the status strip.
  let invoice: BoardInvoiceDTO | null = null;
  if (ticket.publication) {
    const row = await getInvoiceForTicketPublication(ticket.publication.id);
    if (row) {
      invoice = {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        grossAmount: Number(row.grossAmount),
        issuedAt: row.issuedAt.toISOString(),
        dueAt: row.dueAt.toISOString(),
        status: row.status as "PENDING" | "PAID",
        paidAt: row.paidAt?.toISOString() ?? null,
        hasFile: !!row.storageKey,
        contractorName: row.bid.bidder.name,
      };
    }
  }

  return (
    <TicketDetailView ticket={ticket} locale={locale} invoice={invoice} />
  );
}
