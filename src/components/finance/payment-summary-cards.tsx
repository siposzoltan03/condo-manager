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
          <div key={i} className="animate-pulse rounded-xl bg-white p-8">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-4 h-10 w-32 rounded bg-gray-200" />
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
      <div className="relative overflow-hidden rounded-xl bg-white p-8">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-50 opacity-50" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[#d6e3ff] p-3">
            <Wallet className="h-5 w-5 text-[#002045]" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#515f74]">
            {t("currentBalance")}
          </p>
          <p className="mt-2 text-4xl font-extrabold text-[#002045]">
            {summary ? formatCurrency(summary.currentBalance, locale) : "—"}
          </p>
          {summary && (
            <div className="mt-3 flex items-center gap-1.5">
              {isFullySettled ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">{t("fullySettled")}</span>
                </>
              ) : hasOverdue ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">{t("overdue")}</span>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Next Payment Due */}
      <div className="relative overflow-hidden rounded-xl bg-white p-8">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-50 opacity-50" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[#d6e3ff] p-3">
            <CalendarClock className="h-5 w-5 text-[#002045]" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#515f74]">
            {t("nextPaymentDue")}
          </p>
          {summary?.nextDue ? (
            <>
              <p className="mt-2 text-4xl font-extrabold text-[#002045]">
                {formatCurrency(summary.nextDue.amount, locale)}
              </p>
              <p className="mt-1 text-sm text-[#515f74]">{summary.nextDue.month}</p>
              <button className="mt-3 rounded-full bg-[#002045] px-5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#003060]">
                {t("payNow")}
              </button>
            </>
          ) : (
            <p className="mt-2 text-lg text-[#515f74]">—</p>
          )}
        </div>
      </div>

      {/* Payment Status */}
      <div className="relative overflow-hidden rounded-xl bg-white p-8">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-50 opacity-50" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-[#d6e3ff] p-3">
            <ShieldCheck className="h-5 w-5 text-[#002045]" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#515f74]">
            {t("paymentStatus")}
          </p>
          <div className="mt-4">
            {summary ? (
              isFullySettled ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700">
                  {t("paid")}
                </span>
              ) : hasOverdue ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-700">
                  {t("overdue")}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-700">
                  {t("pending")}
                </span>
              )
            ) : (
              <span className="text-lg text-[#515f74]">—</span>
            )}
          </div>
          {summary?.lastPayment && (
            <p className="mt-3 text-xs text-[#515f74]">
              {formatDate(summary.lastPayment.paidAt, locale)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
