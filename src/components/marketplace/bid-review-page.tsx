"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MessageThread } from "@/components/marketplace/message-thread";

interface BidDTO {
  id: string;
  amount: number;
  etaDays: number;
  notes: string | null;
  status: string;
  createdAt: string;
  bidder: {
    id: string;
    name: string;
    plan: string;
    navConfirmed: boolean;
    awardedCount: number;
    avgRating: number | null;
    ratingCount: number;
    badges: string[];
  };
  fit: {
    score: number;
    rationale: string;
    weightsVersion: string;
  } | null;
}
interface PublicationSummary {
  id: string;
  status: string;
  scrubbedTitle: string;
  publishedAt: string;
  deadlineAt: string | null;
}

type SortKey = "bestFit" | "amount" | "eta" | "createdAt";

export function BidReviewPage({
  ticketId,
  locale,
  ticketTitle,
  publication,
}: {
  ticketId: string;
  locale: "hu" | "en";
  ticketTitle: string;
  publication: PublicationSummary;
}) {
  const t = useTranslations("marketplace");
  const [bids, setBids] = useState<BidDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("bestFit");
  const [awardingId, setAwardingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/bids`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(t("loadFailed"));
        return;
      }
      const data = (await res.json()) as { bids: BidDTO[] };
      setBids(data.bids);
    } catch {
      setError(t("loadFailed"));
    }
  }, [ticketId, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function award(bidId: string) {
    const confirmed = window.confirm(t("reviewAwardConfirm"));
    if (!confirmed) return;
    setAwardingId(bidId);
    try {
      const res = await fetch(
        `/api/maintenance/tickets/${ticketId}/bids/${bidId}/award`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error(t("reviewAwardFailed"));
        return;
      }
      toast.success(t("reviewAwardCta"));
      await reload();
    } finally {
      setAwardingId(null);
    }
  }

  const sorted = bids ? sortBids(bids, sortKey) : [];
  const showActions = publication.status === "OPEN";

  return (
    <div
      style={{
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        padding: "24px 32px 80px",
      }}
    >
      <Link
        href={`/${locale}/maintenance/${ticketId}`}
        className="font-mono"
        style={{
          fontSize: "12px",
          color: "var(--color-ink-soft)",
          textDecoration: "underline",
          letterSpacing: "0.04em",
        }}
      >
        {t("reviewBack")}
      </Link>

      <header style={{ margin: "16px 0 24px" }}>
        <span
          className="font-mono block"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
          }}
        >
          {t("reviewEyebrow")}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            margin: "6px 0 4px",
          }}
        >
          {t("reviewTitle")}
        </h1>
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {ticketTitle} · {publication.scrubbedTitle} ·{" "}
          {t("reviewBidCount", { count: bids?.length ?? 0 })}
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border mb-4"
          style={{
            padding: "10px 14px",
            fontSize: "13px",
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      {bids && bids.length > 0 && (
        <SortBar sortKey={sortKey} setSortKey={setSortKey} />
      )}

      {bids === null ? (
        <Skeleton />
      ) : bids.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3" style={{ listStyle: "none", padding: 0 }}>
          {sorted.map((b, idx) => (
            <BidCard
              key={b.id}
              bid={b}
              publicationId={publication.id}
              rank={idx + 1}
              locale={locale}
              awarding={awardingId === b.id}
              showActions={showActions}
              onAward={() => award(b.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SortBar({
  sortKey,
  setSortKey,
}: {
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
}) {
  const t = useTranslations("marketplace");
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <span
        className="font-mono"
        style={{
          fontSize: "10.5px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {t("reviewSortLabel")}
      </span>
      {(
        [
          ["bestFit", t("reviewSortBestFit")],
          ["amount", t("reviewSortAmount")],
          ["eta", t("reviewSortEta")],
          ["createdAt", t("reviewSortCreated")],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => setSortKey(k)}
          className="font-mono"
          style={{
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            letterSpacing: "0.04em",
            background:
              sortKey === k ? "var(--color-ink)" : "var(--color-bg-3)",
            color: sortKey === k ? "var(--color-bg)" : "var(--color-ink-soft)",
            border:
              sortKey === k
                ? "1px solid var(--color-ink)"
                : "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            fontWeight: sortKey === k ? 600 : 500,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BidCard({
  bid,
  publicationId,
  rank,
  locale,
  awarding,
  showActions,
  onAward,
}: {
  bid: BidDTO;
  publicationId: string;
  rank: number;
  locale: "hu" | "en";
  awarding: boolean;
  showActions: boolean;
  onAward: () => void;
}) {
  const t = useTranslations("marketplace");
  const won = bid.status === "WON";
  const [threadOpen, setThreadOpen] = useState(false);
  return (
    <li
      className="rounded-xl border"
      style={{
        padding: "16px 18px",
        background: won
          ? "color-mix(in srgb, var(--color-good) 8%, var(--color-bg))"
          : "var(--color-bg-3)",
        borderColor: won
          ? "color-mix(in srgb, var(--color-good) 40%, transparent)"
          : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono"
            style={{
              width: "26px",
              height: "26px",
              display: "inline-grid",
              placeItems: "center",
              borderRadius: "6px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {won ? "✓" : `#${rank}`}
          </span>
          <div>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--color-ink)",
                margin: 0,
              }}
            >
              {bid.bidder.name}
            </p>
            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.04em",
                marginTop: "2px",
              }}
            >
              {bid.bidder.plan}
              {" · "}
              {bid.bidder.avgRating !== null
                ? `★ ${bid.bidder.avgRating.toFixed(1)} (${t("ratingCountLabel", { count: bid.bidder.ratingCount })})`
                : t("ratingNoYet")}
              {" · "}
              {t("reviewAwardedCount", { count: bid.bidder.awardedCount })}
            </p>
            {(bid.bidder.badges.length > 0 ||
              bid.bidder.plan === "PREMIUM") && (
              <div
                className="flex gap-1 flex-wrap"
                style={{ marginTop: "6px" }}
              >
                {bid.bidder.plan === "PREMIUM" && <FeaturedBadge />}
                {bid.bidder.badges.map((slug) => (
                  <TrustBadge key={slug} slug={slug} />
                ))}
              </div>
            )}
          </div>
        </div>

        {showActions && bid.status === "SUBMITTED" && (
          <button
            type="button"
            onClick={onAward}
            disabled={awarding}
            className="disabled:opacity-60"
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              flexShrink: 0,
            }}
          >
            {awarding ? t("reviewAwardingLabel") : t("reviewAwardCta")}
          </button>
        )}
        {won && (
          <span
            className="font-mono"
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              background: "var(--color-good)",
              color: "var(--color-bg)",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            {t("bidStatusWon")}
          </span>
        )}
      </header>

      <dl
        className="grid grid-cols-[max-content_1fr] sm:grid-cols-[max-content_1fr_max-content_1fr] mt-3"
        style={{ gap: "6px 14px", fontSize: "13px" }}
      >
        <dt
          className="font-mono"
          style={{
            fontSize: "10.5px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("reviewAmount")}
        </dt>
        <dd style={{ fontWeight: 600, color: "var(--color-ink)" }}>
          {t("reviewFt", { amount: bid.amount.toLocaleString(locale) })}
        </dd>
        <dt
          className="font-mono"
          style={{
            fontSize: "10.5px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("reviewEta")}
        </dt>
        <dd style={{ color: "var(--color-ink)" }}>
          {t("reviewDays", { count: bid.etaDays })}
        </dd>
      </dl>

      {bid.fit && (
        <FitScoreStrip
          score={bid.fit.score}
          rationale={bid.fit.rationale}
          version={bid.fit.weightsVersion}
        />
      )}

      {bid.notes && (
        <p
          style={{
            marginTop: "10px",
            padding: "8px 12px",
            fontSize: "13px",
            color: "var(--color-ink-soft)",
            background: "var(--color-bg)",
            borderRadius: "6px",
            borderLeft: "3px solid var(--color-moss)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {bid.notes}
        </p>
      )}

      <div className="flex justify-end" style={{ marginTop: "10px" }}>
        <button
          type="button"
          onClick={() => setThreadOpen((v) => !v)}
          className="font-mono"
          style={{
            fontSize: "11.5px",
            color: "var(--color-ink)",
            textDecoration: "underline",
            letterSpacing: "0.04em",
          }}
        >
          {threadOpen ? "▾ " : "▸ "}
          {t("messagesHeading")}
        </button>
      </div>
      {threadOpen && (
        <div style={{ marginTop: "10px" }}>
          <MessageThread
            publicationId={publicationId}
            bidderId={bid.bidder.id}
            locale={locale}
          />
        </div>
      )}
    </li>
  );
}

function Skeleton() {
  return (
    <ul className="flex flex-col gap-3" style={{ listStyle: "none", padding: 0 }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl"
          style={{
            height: "120px",
            background: "var(--color-bg-3)",
            opacity: 0.5,
          }}
        />
      ))}
    </ul>
  );
}

function EmptyState() {
  const t = useTranslations("marketplace");
  return (
    <div
      className="rounded-xl border text-center"
      style={{
        padding: "40px 24px",
        borderStyle: "dashed",
        borderColor: "color-mix(in srgb, var(--color-ink) 12%, transparent)",
        background: "var(--color-bg-3)",
      }}
    >
      <p
        style={{
          fontSize: "14.5px",
          color: "var(--color-ink-soft)",
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {t("reviewNoBids")}
      </p>
    </div>
  );
}

function FitScoreStrip({
  score,
  rationale,
  version,
}: {
  score: number;
  rationale: string;
  version: string;
}) {
  const t = useTranslations("marketplace");
  const tone =
    score >= 75
      ? "var(--color-good)"
      : score >= 50
        ? "var(--color-moss)"
        : score >= 25
          ? "var(--color-ochre)"
          : "var(--color-muted)";
  return (
    <div
      className="rounded-lg"
      style={{
        marginTop: "10px",
        padding: "10px 12px",
        background: `color-mix(in srgb, ${tone} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "3px 7px",
              borderRadius: "5px",
              background: tone,
              color: "var(--color-bg)",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            {score} / 100
          </span>
          <span
            style={{ fontSize: "13px", color: "var(--color-ink)" }}
          >
            {rationale}
          </span>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
          title={t("fitScoreHint", { version })}
        >
          {t("fitScoreLabel")} · {version}
        </span>
      </div>
    </div>
  );
}

const TRUST_BADGE_KEY: Record<string, string> = {
  "nav-confirmed": "trustNavConfirmed",
  experienced: "trustExperienced",
  "highly-rated": "trustHighlyRated",
  insured: "trustInsured",
  "district-expert": "trustDistrictExpert",
};

function FeaturedBadge() {
  const t = useTranslations("marketplace");
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "4px",
        background: "var(--color-ochre)",
        border: "1px solid var(--color-ochre)",
        color: "var(--color-ink)",
        letterSpacing: "0.06em",
        fontWeight: 700,
        textTransform: "uppercase",
      }}
    >
      ★ {t("featuredLabel")}
    </span>
  );
}

function TrustBadge({ slug }: { slug: string }) {
  const t = useTranslations("marketplace");
  const key = TRUST_BADGE_KEY[slug];
  if (!key) return null;
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "4px",
        background: "color-mix(in srgb, var(--color-moss) 14%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-moss) 30%, transparent)",
        color: "var(--color-moss)",
        letterSpacing: "0.04em",
      }}
    >
      ✓ {t(key as never)}
    </span>
  );
}

function sortBids(bids: BidDTO[], key: SortKey): BidDTO[] {
  const arr = [...bids];
  if (key === "bestFit") {
    // Best-fit primary, PREMIUM as the tie-breaker — Premium contractors
    // pay for the marketing nudge but it ONLY breaks score ties.
    arr.sort((a, b) => {
      const ds = (b.fit?.score ?? -1) - (a.fit?.score ?? -1);
      if (ds !== 0) return ds;
      const ap = a.bidder.plan === "PREMIUM" ? 1 : 0;
      const bp = b.bidder.plan === "PREMIUM" ? 1 : 0;
      return bp - ap;
    });
  }
  if (key === "amount") arr.sort((a, b) => a.amount - b.amount);
  if (key === "eta") arr.sort((a, b) => a.etaDays - b.etaDays);
  if (key === "createdAt")
    arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  // Always pin WON to the top.
  arr.sort((a, b) => (a.status === "WON" ? -1 : b.status === "WON" ? 1 : 0));
  return arr;
}
