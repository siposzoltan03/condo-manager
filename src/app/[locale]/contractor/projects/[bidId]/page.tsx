import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getWonBidWithProject } from "@/lib/marketplace";
import { getTranslations } from "next-intl/server";
import { MessageThread } from "@/components/marketplace/message-thread";
import { PageHead } from "@/components/contractor/page-head";
import { ProjectActions } from "@/components/contractor/project-actions";
import {
  ProjectInvoice,
  type ProjectInvoiceDTO,
} from "@/components/contractor/project-invoice";

interface PageProps {
  params: Promise<{ locale: string; bidId: string }>;
}

/**
 * Won-bid detail page for the contractor. Surfaces:
 *   - The frozen publication scrub (title, description, urgency)
 *   - Unmasked address / unit / owner-phone, gated by the
 *     publication's reveal flags (the same gating used in the
 *     winner email).
 *   - Board contact (always shared with the winner).
 *   - The contractor's own bid (amount, eta, notes).
 *   - The full message thread.
 *   - Any rating the publishing board left after completion.
 */
export default async function ContractorProjectDetailPage({ params }: PageProps) {
  const { locale, bidId } = await params;
  const session = await auth();
  const orgId = session?.user?.contractorOrgId;
  if (!session?.user || !orgId) {
    redirect(`/${locale}/contractor/login`);
  }

  const bid = await getWonBidWithProject(bidId, orgId);
  if (!bid) notFound();
  if (!bid.publication.ticket) notFound();

  const t = await getTranslations({ locale, namespace: "marketplace" });
  const pub = bid.publication;
  const ticket = pub.ticket;

  const fullAddress = pub.revealAddressOnAward
    ? `${ticket.building.zipCode} ${ticket.building.city}, ${ticket.building.address}`
    : null;
  const unit = pub.revealUnitOnAward ? ticket.location : null;
  // Owner phone isn't modelled on the ticket yet — Phase 5 follow-up.
  const ownerPhone = pub.revealOwnerPhoneOnAward ? null : null;

  const rating = ticket.ratings[0];
  const invoiceDTO: ProjectInvoiceDTO | null = bid.invoice
    ? {
        id: bid.invoice.id,
        invoiceNumber: bid.invoice.invoiceNumber,
        grossAmount: Number(bid.invoice.grossAmount),
        issuedAt: bid.invoice.issuedAt.toISOString(),
        dueAt: bid.invoice.dueAt.toISOString(),
        status: bid.invoice.status as "PENDING" | "PAID",
        paidAt: bid.invoice.paidAt?.toISOString() ?? null,
        hasFile: !!bid.invoice.storageKey,
        fileName: bid.invoice.fileName,
      }
    : null;
  // Render the invoice block once the contractor has marked the work done
  // (COMPLETED) and forever after (so the PAID card persists once verified).
  // Hide it pre-completion to keep the right rail focused on the active step.
  const showInvoice =
    !!invoiceDTO ||
    ticket.status === "COMPLETED" ||
    ticket.status === "VERIFIED";
  const ticketStatusLabel =
    ticket.status === "IN_PROGRESS"
      ? t("ticketStatusInProgress")
      : ticket.status === "COMPLETED"
        ? t("ticketStatusCompleted")
        : ticket.status === "VERIFIED"
          ? t("ticketStatusVerified")
          : ticket.status === "ASSIGNED"
            ? t("ticketStatusAssigned")
            : ticket.status;
  const ticketTone =
    ticket.status === "COMPLETED" || ticket.status === "VERIFIED"
      ? "var(--color-good)"
      : "var(--color-ochre)";

  return (
    <div style={{ color: "var(--color-ink)" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "1080px", padding: "32px 24px 80px" }}
      >
        <Link
          href={`/${locale}/contractor/projects`}
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-ink-soft)",
            textDecoration: "underline",
            letterSpacing: "0.04em",
          }}
        >
          {t("projectDetailBackLink")}
        </Link>

        <div style={{ marginTop: "16px" }}>
          <PageHead
            pulse
            eyebrow={`/ ${t("projectsEyebrow").replace(/^\/\s*/, "")}`}
            title={pub.scrubbedTitle}
            subtitle={
              <>
                <strong style={{ fontWeight: 500, color: "var(--color-ink)" }}>
                  {pub.publisherDisplayName}
                </strong>{" "}
                · {pub.zip} {pub.city} ·{" "}
                {t("projectDetailAwardedAt")}{" "}
                {pub.awardedAt
                  ? new Date(pub.awardedAt).toLocaleDateString(locale)
                  : "—"}
              </>
            }
            actions={
              <span
                className="font-mono"
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: ticketTone,
                  color: "var(--color-bg)",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {ticketStatusLabel}
              </span>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-6 mt-4">
          {/* ── Left column ───────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <DescriptionCard
              label={t("projectDetailDescription")}
              body={pub.scrubbedDescription}
            />

            <ContactCard
              t={t}
              fullAddress={fullAddress}
              unit={unit}
              ownerPhone={ownerPhone}
              boardContactEmail={pub.boardContactEmail}
              boardContactPhone={pub.boardContactPhone}
              publisherName={pub.publisherDisplayName}
              redacted={t("projectDetailRedacted")}
            />

            {rating && (
              <RatingCard
                label={t("projectDetailRatingReceived")}
                rating={rating.rating}
                notes={rating.notes}
                date={new Date(rating.createdAt).toLocaleDateString(locale)}
              />
            )}

            <div>
              <SectionLabel>{t("projectDetailMessagesTitle")}</SectionLabel>
              <MessageThread
                publicationId={pub.id}
                bidderId={orgId}
                locale={locale as "hu" | "en"}
              />
            </div>
          </div>

          {/* ── Right sidebar ────────────────────────────────────── */}
          <aside className="flex flex-col gap-4">
            <ProjectActions bidId={bid.id} ticketStatus={ticket.status} />
            {showInvoice && (
              <ProjectInvoice
                bidId={bid.id}
                invoice={invoiceDTO}
                locale={locale}
              />
            )}
            <BidCard
              label={t("projectDetailYourBid")}
              amount={Number(bid.amount)}
              etaDays={bid.etaDays}
              notes={bid.notes}
              labels={{
                amount: t("projectDetailBidAmount"),
                eta: t("projectDetailBidEta"),
                notes: t("projectDetailBidNotes"),
                ftValue: t("reviewFt", { amount: "VAL" }),
                daysValue: t("reviewDays", { count: 0 }),
              }}
              locale={locale}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function DescriptionCard({ label, body }: { label: string; body: string }) {
  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: "var(--color-bg-3)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      <p
        style={{
          fontSize: "14px",
          lineHeight: "1.6",
          margin: 0,
          color: "var(--color-ink)",
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
      </p>
    </section>
  );
}

function ContactCard({
  t,
  fullAddress,
  unit,
  ownerPhone,
  boardContactEmail,
  boardContactPhone,
  publisherName,
  redacted,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  fullAddress: string | null;
  unit: string | null;
  ownerPhone: string | null;
  boardContactEmail: string;
  boardContactPhone: string | null;
  publisherName: string;
  redacted: string;
}) {
  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: "var(--color-bg-3)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <SectionLabel>{t("projectDetailContact")}</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <Row label={t("projectDetailContactName")} value={publisherName} />
          <Row label={t("projectDetailContactEmail")} value={boardContactEmail} />
          <Row
            label={t("projectDetailContactPhone")}
            value={boardContactPhone ?? "—"}
          />
          <Row
            label={t("projectDetailFullAddress")}
            value={fullAddress ?? redacted}
            redacted={!fullAddress}
          />
          <Row
            label={t("projectDetailUnit")}
            value={unit ?? redacted}
            redacted={!unit}
          />
          <Row
            label={t("projectDetailOwnerPhone")}
            value={ownerPhone ?? redacted}
            redacted={!ownerPhone}
          />
        </tbody>
      </table>
    </section>
  );
}

function Row({
  label,
  value,
  redacted,
}: {
  label: string;
  value: string;
  redacted?: boolean;
}) {
  return (
    <tr>
      <td
        className="font-mono"
        style={{
          padding: "8px 12px 8px 0",
          color: "var(--color-muted)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          verticalAlign: "top",
          width: "160px",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "8px 0",
          color: redacted ? "var(--color-muted)" : "var(--color-ink)",
          fontSize: "13.5px",
          fontStyle: redacted ? "italic" : "normal",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function RatingCard({
  label,
  rating,
  notes,
  date,
}: {
  label: string;
  rating: number;
  notes: string | null;
  date: string;
}) {
  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: "color-mix(in srgb, var(--color-moss) 8%, var(--color-bg-3))",
        borderColor: "color-mix(in srgb, var(--color-moss) 30%, transparent)",
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: "22px", color: "var(--color-ochre)" }}>
          {"★".repeat(rating)}
          <span style={{ color: "var(--color-muted)" }}>
            {"☆".repeat(5 - rating)}
          </span>
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {date}
        </span>
      </div>
      {notes && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "13.5px",
            color: "var(--color-ink-soft)",
            lineHeight: 1.55,
            fontStyle: "italic",
          }}
        >
          “{notes}”
        </p>
      )}
    </section>
  );
}

function BidCard({
  label,
  amount,
  etaDays,
  notes,
  labels,
  locale,
}: {
  label: string;
  amount: number;
  etaDays: number;
  notes: string | null;
  labels: {
    amount: string;
    eta: string;
    notes: string;
    ftValue: string;
    daysValue: string;
  };
  locale: string;
}) {
  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: "var(--color-bg)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <SectionLabel>{label}</SectionLabel>
      <div
        className="flex items-baseline justify-between gap-3"
        style={{ marginBottom: "8px" }}
      >
        <span
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "28px",
            fontWeight: 500,
            letterSpacing: "-0.03em",
          }}
        >
          {amount.toLocaleString(locale)}{" "}
          <small
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
            }}
          >
            FT
          </small>
        </span>
      </div>
      <dl
        className="grid"
        style={{
          gridTemplateColumns: "max-content 1fr",
          gap: "6px 14px",
          fontSize: "12.5px",
        }}
      >
        <dt
          className="font-mono"
          style={{
            color: "var(--color-muted)",
            fontSize: "10.5px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {labels.eta}
        </dt>
        <dd style={{ color: "var(--color-ink)" }}>{etaDays} nap</dd>
      </dl>
      {notes && (
        <div style={{ marginTop: "12px" }}>
          <SectionLabel>{labels.notes}</SectionLabel>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-ink-soft)",
              lineHeight: 1.55,
              margin: 0,
              whiteSpace: "pre-wrap",
              padding: "10px 12px",
              borderLeft: "3px solid var(--color-moss)",
              background: "var(--color-bg-3)",
              borderRadius: "6px",
            }}
          >
            {notes}
          </p>
        </div>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono block"
      style={{
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: "10px",
      }}
    >
      {children}
    </span>
  );
}
