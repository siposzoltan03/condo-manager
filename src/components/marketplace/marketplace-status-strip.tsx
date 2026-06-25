"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type PublicationStatus = "DRAFT" | "OPEN" | "AWARDED" | "CLOSED";

interface PublicationSummary {
  id: string;
  status: PublicationStatus;
  bidsCount: number;
  publishedAt: string;
  deadlineAt: string | null;
  awardedAt: string | null;
  closedAt: string | null;
}

/**
 * Strip rendered on the ticket detail page once a marketplace
 * publication exists. Surfaces status + bid count + (for board users)
 * the "review bids" + "close without award" actions.
 *
 * Phase 4 will replace the placeholder review link with the real
 * /maintenance/tickets/[id]/bids board.
 */
export function MarketplaceStatusStrip({
  publication,
  ticketId,
  isBoardPlus,
  locale,
  onChanged,
}: {
  publication: PublicationSummary;
  ticketId: string;
  isBoardPlus: boolean;
  locale: string;
  onChanged: () => void;
}) {
  const t = useTranslations("marketplace");
  const [closing, setClosing] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const statusLabel =
    publication.status === "OPEN"
      ? t("statusOpenLabel")
      : publication.status === "AWARDED"
        ? t("statusAwardedLabel")
        : publication.status === "CLOSED"
          ? t("statusClosedLabel")
          : publication.status;

  const tint =
    publication.status === "OPEN"
      ? "var(--color-moss)"
      : publication.status === "AWARDED"
        ? "var(--color-good)"
        : "var(--color-muted)";

  async function closeNow() {
    setClosing(true);
    try {
      const res = await fetch(
        `/api/maintenance/tickets/${ticketId}/publish/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: closeReason }),
        },
      );
      if (!res.ok) {
        toast.error(t("publishError"));
        return;
      }
      setConfirmingClose(false);
      onChanged();
    } finally {
      setClosing(false);
    }
  }

  return (
    <div
      className="rounded-xl border"
      style={{
        marginTop: "14px",
        padding: "14px 16px",
        background: "var(--color-bg-3)",
        borderColor:
          publication.status === "OPEN"
            ? "color-mix(in srgb, var(--color-moss) 30%, transparent)"
            : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono"
            style={{
              fontSize: "10.5px",
              padding: "3px 9px",
              borderRadius: "5px",
              background: `color-mix(in srgb, ${tint} 18%, transparent)`,
              border: `1px solid color-mix(in srgb, ${tint} 35%, transparent)`,
              color: tint,
              letterSpacing: "0.06em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {statusLabel}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "var(--color-ink)",
              fontWeight: 500,
            }}
          >
            {t("statusBidsCount", { count: publication.bidsCount })}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {t("statusOpenSince", {
              date: new Date(publication.publishedAt).toLocaleDateString(locale),
            })}
          </span>
        </div>
        {isBoardPlus && publication.status === "OPEN" && (
          <div className="flex items-center gap-2">
            <a
              href={`/${locale}/maintenance/${ticketId}/bids`}
              className="font-mono"
              style={{
                fontSize: "12px",
                color: "var(--color-ink)",
                textDecoration: "underline",
                letterSpacing: "0.04em",
              }}
            >
              {t("statusReviewBids")}
            </a>
            <button
              type="button"
              onClick={() => setConfirmingClose(true)}
              className="font-mono"
              style={{
                fontSize: "11.5px",
                color: "var(--color-danger)",
                letterSpacing: "0.04em",
                textDecoration: "underline",
              }}
            >
              {t("statusCloseWithoutAward")}
            </button>
          </div>
        )}
      </div>

      {confirmingClose && (
        <div
          className="rounded-lg border"
          style={{
            marginTop: "12px",
            padding: "12px 14px",
            background: "var(--color-bg)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-ink)",
              margin: "0 0 4px",
            }}
          >
            {t("closeConfirmTitle")}
          </p>
          <p
            style={{
              fontSize: "12.5px",
              color: "var(--color-ink-soft)",
              margin: "0 0 10px",
              lineHeight: 1.5,
            }}
          >
            {t("closeConfirmBody")}
          </p>
          <label
            className="block font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              marginBottom: "4px",
            }}
          >
            {t("closeReason")}
          </label>
          <input
            type="text"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder={t("closeReasonPlaceholder")}
            style={{
              width: "100%",
              padding: "9px 12px",
              fontSize: "13px",
              background: "var(--color-bg-3)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              borderRadius: "6px",
              outline: "none",
              marginBottom: "12px",
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingClose(false)}
              className="font-mono"
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                background: "var(--color-bg-3)",
                color: "var(--color-ink)",
                letterSpacing: "0.04em",
              }}
            >
              {t("wizardCancel")}
            </button>
            <button
              type="button"
              onClick={closeNow}
              disabled={closing}
              className="disabled:opacity-60"
              style={{
                padding: "9px 16px",
                borderRadius: "6px",
                fontSize: "12.5px",
                fontWeight: 600,
                background: "var(--color-danger)",
                color: "var(--color-bg)",
              }}
            >
              {closing ? "…" : t("closeSubmit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
