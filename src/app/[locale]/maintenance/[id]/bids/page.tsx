import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { findTicketForBidReview } from "@/lib/maintenance-dal";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { BidReviewPage } from "@/components/marketplace/bid-review-page";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function TicketBidsPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  let userBlock;
  try {
    userBlock = await requireBuildingContext();
  } catch {
    redirect(`/${locale}/login`);
  }
  if (!hasMinimumRole(userBlock.role, "BOARD_MEMBER")) {
    redirect(`/${locale}/maintenance/${id}`);
  }

  const ticket = await findTicketForBidReview({
    id,
    buildingId: userBlock.buildingId,
  });
  if (!ticket) notFound();
  if (!ticket.publication) notFound();

  return (
    <BidReviewPage
      ticketId={id}
      locale={locale as "hu" | "en"}
      ticketTitle={ticket.title}
      publication={{
        id: ticket.publication.id,
        status: ticket.publication.status,
        scrubbedTitle: ticket.publication.scrubbedTitle,
        publishedAt: ticket.publication.publishedAt.toISOString(),
        deadlineAt: ticket.publication.deadlineAt?.toISOString() ?? null,
      }}
    />
  );
}
