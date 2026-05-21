"use client";

import { useTranslations } from "next-intl";
import {
  BUDGET_BANDS,
  PUBLICATION_URGENCIES,
  type BudgetBand,
  type PublicationUrgency,
} from "@/lib/marketplace/category-mapping";

export interface LeadCardData {
  scrubbedTitle: string;
  scrubbedDescription: string;
  category: string;
  urgency: PublicationUrgency;
  city: string;
  zip: string;
  budgetBand: BudgetBand | null;
  deadlineAt: Date | null;
  /** ISO publishedAt; null on the preview before save. */
  publishedAt: Date | null;
  publisherDisplayName: string;
  bidsCount: number;
}

/**
 * Scrubbed-publication card. The single source of truth for both:
 *   - the publish wizard live preview (board side)
 *   - the contractor marketplace board (Phase 4)
 *
 * Bit-identical rendering avoids drift between "what we promised the
 * board they'd reveal" and "what the contractor actually sees".
 */
export function LeadCard({
  data,
  locale = "hu",
}: {
  data: LeadCardData;
  locale?: "hu" | "en";
}) {
  const t = useTranslations("marketplace");

  const urgency = PUBLICATION_URGENCIES.find((u) => u.slug === data.urgency);
  const budget = data.budgetBand
    ? BUDGET_BANDS.find((b) => b.slug === data.budgetBand)
    : null;
  const urgencyLabel = urgency
    ? locale === "en"
      ? urgency.en
      : urgency.hu
    : data.urgency;
  const budgetLabel = budget ? (locale === "en" ? budget.en : budget.hu) : null;
  const categoryLabel = t(`category${data.category}`);

  const urgencyTint =
    data.urgency === "URGENT"
      ? "var(--color-danger)"
      : data.urgency === "MEDIUM"
        ? "var(--color-ochre)"
        : "var(--color-moss)";

  return (
    <article
      className="rounded-xl border"
      style={{
        padding: "20px",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: "var(--color-bg)",
      }}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              borderRadius: "5px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              letterSpacing: "0.06em",
            }}
          >
            {categoryLabel}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              borderRadius: "5px",
              background: `color-mix(in srgb, ${urgencyTint} 15%, transparent)`,
              color: urgencyTint,
              border: `1px solid color-mix(in srgb, ${urgencyTint} 35%, transparent)`,
              letterSpacing: "0.06em",
              fontWeight: 600,
            }}
          >
            {urgencyLabel}
          </span>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {data.zip} {data.city}
        </span>
      </header>

      <h3
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "18px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: "1.25",
          margin: "0 0 6px",
          color: "var(--color-ink)",
        }}
      >
        {data.scrubbedTitle || "—"}
      </h3>

      <p
        style={{
          fontSize: "13.5px",
          color: "var(--color-ink-soft)",
          lineHeight: "1.55",
          margin: "0 0 14px",
          whiteSpace: "pre-wrap",
        }}
      >
        {data.scrubbedDescription || "—"}
      </p>

      <dl
        className="font-mono grid grid-cols-[max-content_1fr] sm:grid-cols-[max-content_1fr_max-content_1fr]"
        style={{
          gap: "6px 14px",
          fontSize: "11px",
          letterSpacing: "0.04em",
          paddingTop: "12px",
          borderTop:
            "1px dashed color-mix(in srgb, var(--color-ink) 10%, transparent)",
        }}
      >
        <dt style={{ color: "var(--color-muted)" }}>
          {t("leadCardFromLabel")}
        </dt>
        <dd style={{ color: "var(--color-ink)" }}>{data.publisherDisplayName}</dd>
        <dt style={{ color: "var(--color-muted)" }}>
          {t("leadCardBidsLabel")}
        </dt>
        <dd style={{ color: "var(--color-ink)" }}>{data.bidsCount}</dd>
        <dt style={{ color: "var(--color-muted)" }}>
          {t("leadCardBudgetLabel")}
        </dt>
        <dd style={{ color: "var(--color-ink)" }}>{budgetLabel ?? "—"}</dd>
        <dt style={{ color: "var(--color-muted)" }}>
          {t("leadCardDeadlineLabel")}
        </dt>
        <dd style={{ color: "var(--color-ink)" }}>
          {data.deadlineAt ? data.deadlineAt.toLocaleDateString(locale) : "—"}
        </dd>
      </dl>
    </article>
  );
}
