"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LeadCard, type LeadCardData } from "@/components/marketplace/lead-card";
import { MessageThread } from "@/components/marketplace/message-thread";
import { AuthField, authInputStyle } from "./auth-field";
import { PageHead } from "./page-head";

interface PublicationDTO {
  id: string;
  scrubbedTitle: string;
  scrubbedDescription: string;
  category: string;
  urgency: string;
  city: string;
  zip: string;
  budgetBand: string | null;
  deadlineAt: string | null;
  specialties: string[];
  publishedAt: string;
  publisherDisplayName: string;
  bidsCount: number;
}
interface BidDTO {
  id: string;
  amount: number;
  etaDays: number;
  notes: string | null;
  status: string;
  decisionReason: string | null;
  updatedAt: string;
}
interface MedianDTO {
  median: number;
  sampleSize: number;
}

export function PublicationDetail({
  locale,
  publicationId,
  currentOrgId,
}: {
  locale: "hu" | "en";
  publicationId: string;
  currentOrgId: string;
}) {
  const t = useTranslations("marketplace");

  const [pub, setPub] = useState<PublicationDTO | null>(null);
  const [bid, setBid] = useState<BidDTO | null>(null);
  const [median, setMedian] = useState<MedianDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/contractor/marketplace/${publicationId}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = (await res.json()) as {
      publication: PublicationDTO;
      bid: BidDTO | null;
      median: MedianDTO | null;
    };
    setPub(data.publication);
    setBid(data.bid);
    setMedian(data.median);
  }, [publicationId]);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  if (loading) {
    return <Centered>…</Centered>;
  }
  if (notFound || !pub) {
    return (
      <Centered>
        <p style={{ color: "var(--color-ink-soft)", fontSize: "15px" }}>
          {t("detailNotOpen")}
        </p>
        <Link
          href={`/${locale}/contractor/marketplace`}
          className="font-mono mt-2"
          style={{
            fontSize: "12px",
            color: "var(--color-ink)",
            textDecoration: "underline",
            letterSpacing: "0.04em",
          }}
        >
          {t("detailBackLink")}
        </Link>
      </Centered>
    );
  }

  return (
    <div style={{ color: "var(--color-ink)" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "1080px", padding: "32px 24px 80px" }}
      >
        <PageHead
          pulse
          eyebrow={t("detailEyebrow")}
          title={pub.scrubbedTitle}
          subtitle={
            <>
              <strong style={{ fontWeight: 500, color: "var(--color-ink)" }}>
                {pub.publisherDisplayName}
              </strong>{" "}
              · {pub.zip} {pub.city}
            </>
          }
        />

        <div
          className="grid gap-6 mt-4"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
          }}
        >
          <div>
            <LeadCard data={toLeadCardData(pub)} locale={locale} />
            <Specs pub={pub} locale={locale} />
          </div>

          <aside>
            <BidPanel
              publicationId={pub.id}
              existing={bid}
              onSaved={reload}
              locale={locale}
            />
            <MedianWidget median={median} locale={locale} />
            <div style={{ marginTop: "16px" }}>
              <MessageThread
                publicationId={pub.id}
                bidderId={currentOrgId}
                locale={locale}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Specs({
  pub,
  locale,
}: {
  pub: PublicationDTO;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  return (
    <dl
      className="font-mono"
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 1fr",
        gap: "8px 16px",
        marginTop: "20px",
        fontSize: "12px",
        letterSpacing: "0.04em",
      }}
    >
      <dt style={{ color: "var(--color-muted)" }}>{t("detailLocation")}</dt>
      <dd style={{ color: "var(--color-ink)" }}>
        {pub.zip} {pub.city}
      </dd>
      <dt style={{ color: "var(--color-muted)" }}>{t("detailSpecialties")}</dt>
      <dd style={{ color: "var(--color-ink)" }}>{pub.specialties.join(", ")}</dd>
      <dt style={{ color: "var(--color-muted)" }}>{t("detailPublisher")}</dt>
      <dd style={{ color: "var(--color-ink)" }}>{pub.publisherDisplayName}</dd>
      <dt style={{ color: "var(--color-muted)" }}>{t("detailPublished")}</dt>
      <dd style={{ color: "var(--color-ink)" }}>
        {new Date(pub.publishedAt).toLocaleDateString(locale)}
      </dd>
    </dl>
  );
}

// ── Bid form ──────────────────────────────────────────────────────────────

function BidPanel({
  publicationId,
  existing,
  onSaved,
  locale: _locale,
}: {
  publicationId: string;
  existing: BidDTO | null;
  onSaved: () => Promise<void>;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  const [amount, setAmount] = useState<string>(
    existing ? String(existing.amount) : "",
  );
  const [etaDays, setEtaDays] = useState<string>(
    existing ? String(existing.etaDays) : "",
  );
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  async function submit() {
    setError(null);
    setErrorReason(null);
    setSavedHint(false);
    const amt = Number(amount.replace(/\s/g, ""));
    const eta = Number(etaDays);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError(t("bidErrorAmount"));
      return;
    }
    if (!Number.isInteger(eta) || eta < 1) {
      setError(t("bidErrorEta"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contractor/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId,
          amount: amt,
          etaDays: eta,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          reason?: string;
        } | null;
        setError(messageForReason(data?.reason, t));
        setErrorReason(data?.reason ?? null);
        return;
      }
      setSavedHint(true);
      await onSaved();
    } catch {
      setError(t("bidErrorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  // Read-only view if the bid is decided (won or rejected).
  if (existing && existing.status !== "SUBMITTED") {
    return (
      <BidDecidedPanel bid={existing} />
    );
  }

  return (
    <div
      className="rounded-xl border"
      style={{
        padding: "20px",
        background: "var(--color-bg-3)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "20px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          margin: "0 0 4px",
        }}
      >
        {t("bidFormHeading")}
      </h2>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "13px",
          margin: "0 0 16px",
          lineHeight: 1.5,
        }}
      >
        {existing ? t("bidFormExisting") : t("bidFormNew")}
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-md border mb-3"
          style={{
            padding: "8px 12px",
            fontSize: "12.5px",
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          <div>{error}</div>
          {errorReason === "QUOTA_EXCEEDED" && (
            <Link
              href="/hu/contractor/billing"
              className="font-mono inline-block mt-2"
              style={{
                fontSize: "11px",
                color: "var(--color-ink)",
                textDecoration: "underline",
                letterSpacing: "0.04em",
              }}
            >
              {t("quotaUpgradeCta")}
            </Link>
          )}
        </div>
      )}
      {savedHint && (
        <div
          role="status"
          className="rounded-md border mb-3"
          style={{
            padding: "8px 12px",
            fontSize: "12.5px",
            background: "color-mix(in srgb, var(--color-good) 12%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-good) 32%, transparent)",
            color: "var(--color-good)",
          }}
        >
          {t("bidSubmitOk")}
        </div>
      )}

      <AuthField label={t("bidAmount")} htmlFor="bid-amount">
        <input
          id="bid-amount"
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("bidAmountPlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>
      <AuthField label={t("bidEta")} htmlFor="bid-eta">
        <input
          id="bid-eta"
          type="number"
          min={1}
          max={365}
          value={etaDays}
          onChange={(e) => setEtaDays(e.target.value)}
          placeholder={t("bidEtaPlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>
      <AuthField label={t("bidNotes")} htmlFor="bid-notes">
        <textarea
          id="bid-notes"
          value={notes}
          rows={4}
          maxLength={800}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("bidNotesPlaceholder")}
          style={{
            ...authInputStyle(false),
            padding: "10px 12px",
            resize: "vertical",
            minHeight: "90px",
          }}
        />
      </AuthField>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full disabled:opacity-60"
        style={{
          marginTop: "8px",
          padding: "12px 18px",
          borderRadius: "9px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
        }}
      >
        {submitting
          ? "…"
          : existing
            ? t("bidSubmitUpdate")
            : t("bidSubmitNew")}
      </button>
    </div>
  );
}

function BidDecidedPanel({ bid }: { bid: BidDTO }) {
  const t = useTranslations("marketplace");
  const tone =
    bid.status === "WON"
      ? "var(--color-good)"
      : bid.status === "REJECTED"
        ? "var(--color-danger)"
        : "var(--color-muted)";
  const label =
    bid.status === "WON"
      ? t("bidStatusWon")
      : bid.status === "REJECTED"
        ? t("bidStatusRejected")
        : t("bidStatusWithdrawn");
  return (
    <div
      className="rounded-xl border"
      style={{
        padding: "20px",
        background: "var(--color-bg-3)",
        borderColor: `color-mix(in srgb, ${tone} 40%, transparent)`,
      }}
    >
      <span
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {t("bidFormHeading")}
      </span>
      <p
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: tone,
          margin: "0 0 12px",
        }}
      >
        {label}
      </p>
      {bid.decisionReason && (
        <>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {t("rejectReason")}
          </span>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-ink)",
              lineHeight: 1.5,
              margin: "4px 0 0",
            }}
          >
            {bid.decisionReason}
          </p>
        </>
      )}
    </div>
  );
}

function MedianWidget({
  median,
  locale,
}: {
  median: MedianDTO | null;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  return (
    <div
      className="rounded-xl border"
      style={{
        marginTop: "16px",
        padding: "16px",
        background: "var(--color-bg)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <span
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {t("medianHeading")}
      </span>
      {median ? (
        <>
          <p
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--color-ink)",
              margin: "0 0 4px",
            }}
          >
            {t("medianValue", {
              amount: median.median.toLocaleString(locale),
            })}
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {t("medianSample", { count: median.sampleSize })}
          </p>
        </>
      ) : (
        <p
          style={{
            fontSize: "12.5px",
            color: "var(--color-ink-soft)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {t("medianEmpty")}
        </p>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen grid place-items-center"
      style={{ background: "var(--color-bg)", padding: "32px" }}
    >
      <div className="text-center" style={{ maxWidth: "440px" }}>
        {children}
      </div>
    </div>
  );
}

function toLeadCardData(p: PublicationDTO): LeadCardData {
  return {
    scrubbedTitle: p.scrubbedTitle,
    scrubbedDescription: p.scrubbedDescription,
    category: p.category,
    urgency: p.urgency as LeadCardData["urgency"],
    city: p.city,
    zip: p.zip,
    budgetBand: p.budgetBand as LeadCardData["budgetBand"],
    deadlineAt: p.deadlineAt ? new Date(p.deadlineAt) : null,
    publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
    publisherDisplayName: p.publisherDisplayName,
    bidsCount: p.bidsCount,
  };
}

function messageForReason(
  reason: string | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (reason) {
    case "QUOTA_EXCEEDED":
      return t("bidErrorQuota");
    case "NOT_OPEN":
      return t("bidErrorNotOpen");
    case "SPECIALTY_MISMATCH":
      return t("bidErrorSpecialty");
    case "ORG_NOT_ACTIVE":
      return t("bidErrorNotActive");
    case "INVALID_AMOUNT":
      return t("bidErrorAmount");
    case "INVALID_ETA":
      return t("bidErrorEta");
    default:
      return t("bidErrorGeneric");
  }
}
