"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Inline rating prompt shown on a COMPLETED ticket that was awarded
 * through the marketplace. Idempotent on the server — re-submitting
 * just updates the existing row.
 */
export function MarketplaceRatingPrompt({
  ticketId,
  initialRating,
  initialNotes,
  onSaved,
}: {
  ticketId: string;
  initialRating?: number | null;
  initialNotes?: string | null;
  onSaved?: () => void;
}) {
  const t = useTranslations("marketplace");
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [hover, setHover] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);

  async function submit() {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        toast.error(t("bidErrorGeneric"));
        return;
      }
      setDone(true);
      onSaved?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (skipped) return null;

  if (done) {
    return (
      <div
        role="status"
        className="rounded-xl border"
        style={{
          marginTop: "14px",
          padding: "12px 16px",
          background:
            "color-mix(in srgb, var(--color-good) 12%, transparent)",
          borderColor:
            "color-mix(in srgb, var(--color-good) 32%, transparent)",
          color: "var(--color-good)",
          fontSize: "13px",
        }}
      >
        {t("ratingSubmitted")}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border"
      style={{
        marginTop: "14px",
        padding: "16px 18px",
        background: "var(--color-bg-3)",
        borderColor:
          "color-mix(in srgb, var(--color-moss) 30%, transparent)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "16px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 4px",
            }}
          >
            {t("ratingPromptTitle")}
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-ink-soft)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {t("ratingPromptBody")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSkipped(true)}
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            textDecoration: "underline",
            flexShrink: 0,
          }}
        >
          {t("ratingPromptSkip")}
        </button>
      </div>

      <div className="flex items-center gap-1 mt-3" aria-label={t("ratingStarsLabel")}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{
                width: "32px",
                height: "32px",
                fontSize: "22px",
                lineHeight: 1,
                background: "transparent",
                color: active ? "var(--color-ochre)" : "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              ★
            </button>
          );
        })}
      </div>

      <label
        className="block font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          margin: "10px 0 4px",
        }}
      >
        {t("ratingNotesLabel")}
      </label>
      <textarea
        rows={2}
        value={notes}
        maxLength={600}
        onChange={(e) => setNotes(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: "13px",
          background: "var(--color-bg)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "8px",
          outline: "none",
          resize: "vertical",
          minHeight: "60px",
        }}
      />

      <div className="flex justify-end" style={{ marginTop: "10px" }}>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || rating < 1}
          className="disabled:opacity-50"
          style={{
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "12.5px",
            fontWeight: 600,
            background: "var(--color-ink)",
            color: "var(--color-bg)",
          }}
        >
          {submitting ? "…" : t("ratingSubmit")}
        </button>
      </div>
    </div>
  );
}
