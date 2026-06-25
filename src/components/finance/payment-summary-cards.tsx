"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Wallet, CalendarClock, ShieldCheck, CheckCircle, AlertCircle } from "lucide-react";

interface ChargeSummary {
  currentBalance: string | number;
  nextDue: { amount: string | number; month: string } | null;
  lastPayment: { amount: string | number; paidAt: string } | null;
}

interface PaymentSummaryCardsProps {
  summary: ChargeSummary | null;
  loading?: boolean;
}

function formatCurrency(value: string | number, locale: string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat(locale === "hu" ? "hu-HU" : "en-US", {
    style: "currency",
    currency: locale === "hu" ? "HUF" : "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function PaymentSummaryCards({ summary, loading }: PaymentSummaryCardsProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-ink/8 bg-card p-8"
          >
            <div className="h-4 w-24 rounded bg-bg-3" />
            <div className="mt-4 h-10 w-32 rounded bg-bg-3" />
          </div>
        ))}
      </div>
    );
  }

  const balance = summary ? parseFloat(String(summary.currentBalance)) : 0;
  const isFullySettled = balance === 0;
  const hasOverdue = balance > 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Current Balance */}
      <div className="rounded-xl border border-ink/8 bg-card p-7">
        <div
          className="mb-4 inline-flex items-center justify-center rounded-full p-3"
          style={{ background: "var(--color-bg-3)" }}
        >
          <Wallet className="h-5 w-5 text-ink" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {t("currentBalance")}
        </p>
        <p className="mt-2 font-display text-4xl text-ink leading-tight">
          {summary ? formatCurrency(summary.currentBalance, locale) : "—"}
        </p>
        {summary && (
          <div className="mt-3 flex items-center gap-1.5">
            {isFullySettled ? (
              <>
                <CheckCircle
                  className="h-4 w-4"
                  style={{ color: "var(--color-good)" }}
                />
                <span
                  className="font-mono text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--color-good)" }}
                >
                  {t("fullySettled")}
                </span>
              </>
            ) : hasOverdue ? (
              <>
                <AlertCircle
                  className="h-4 w-4"
                  style={{ color: "var(--color-danger)" }}
                />
                <span
                  className="font-mono text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--color-danger)" }}
                >
                  {t("overdue")}
                </span>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Next Payment Due */}
      <div className="rounded-xl border border-ink/8 bg-card p-7">
        <div
          className="mb-4 inline-flex items-center justify-center rounded-full p-3"
          style={{ background: "var(--color-bg-3)" }}
        >
          <CalendarClock className="h-5 w-5 text-ink" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {t("nextPaymentDue")}
        </p>
        {summary?.nextDue ? (
          <>
            <p className="mt-2 font-display text-4xl text-ink leading-tight">
              {formatCurrency(summary.nextDue.amount, locale)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {(() => {
                const [year, month] = summary.nextDue.month.split("-");
                const date = new Date(Number(year), Number(month) - 1);
                return date.toLocaleDateString(locale, {
                  month: "long",
                  year: "numeric",
                });
              })()}
            </p>
            <button
              disabled
              aria-disabled="true"
              title={t("payNowDisabledHint")}
              className="mt-3 rounded-md bg-ink px-5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("payNow")}
            </button>
          </>
        ) : (
          <p className="mt-2 text-lg text-muted">—</p>
        )}
      </div>

      {/* Payment Status */}
      <div className="rounded-xl border border-ink/8 bg-card p-7">
        <div
          className="mb-4 inline-flex items-center justify-center rounded-full p-3"
          style={{ background: "var(--color-bg-3)" }}
        >
          <ShieldCheck className="h-5 w-5 text-ink" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {t("paymentStatus")}
        </p>
        <div className="mt-4">
          {summary ? (
            isFullySettled ? (
              <span
                className="inline-flex items-center rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-good) 18%, transparent)",
                  color: "var(--color-good)",
                }}
              >
                {t("paid")}
              </span>
            ) : hasOverdue ? (
              <span
                className="inline-flex items-center rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-danger) 16%, transparent)",
                  color: "var(--color-danger)",
                }}
              >
                {t("overdue")}
              </span>
            ) : (
              <span
                className="inline-flex items-center rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
                  color:
                    "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
                }}
              >
                {t("pending")}
              </span>
            )
          ) : (
            <span className="text-lg text-muted">—</span>
          )}
        </div>
        {summary?.lastPayment && (
          <p className="mt-3 font-mono text-[11px] text-muted">
            {formatDate(summary.lastPayment.paidAt, locale)}
          </p>
        )}
      </div>
    </div>
  );
}
