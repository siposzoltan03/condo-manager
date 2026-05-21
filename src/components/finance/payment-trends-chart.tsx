"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface MonthlyCharge {
  month: string; // "YYYY-MM"
  amount: string | number;
  status: string;
}

interface PaymentTrendsChartProps {
  charges: MonthlyCharge[];
  loading?: boolean;
}

const MONTH_KEYS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_KEYS_HU = [
  "Jan",
  "Feb",
  "Már",
  "Ápr",
  "Máj",
  "Jún",
  "Júl",
  "Aug",
  "Szep",
  "Okt",
  "Nov",
  "Dec",
];

export function PaymentTrendsChart({ charges, loading }: PaymentTrendsChartProps) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  const monthLabels = locale === "hu" ? MONTH_KEYS_HU : MONTH_KEYS;

  const monthAmounts = new Map<number, number>();
  for (const charge of charges) {
    const [yearStr, monthStr] = charge.month.split("-");
    if (parseInt(yearStr) === selectedYear) {
      const monthIdx = parseInt(monthStr) - 1;
      const amt =
        typeof charge.amount === "string" ? parseFloat(charge.amount) : charge.amount;
      monthAmounts.set(monthIdx, (monthAmounts.get(monthIdx) ?? 0) + amt);
    }
  }

  const maxAmount = Math.max(...Array.from(monthAmounts.values()), 1);
  const years = [currentYear - 1, currentYear, currentYear + 1];

  if (loading) {
    return (
      <div className="rounded-xl border border-ink/8 bg-card p-8">
        <div className="animate-pulse">
          <div className="h-6 w-40 rounded bg-bg-3" />
          <div className="mt-6 flex items-end gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1">
                <div
                  className="rounded-t bg-bg-3"
                  style={{ height: `${40 + Math.random() * 100}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
          {t("monthlyTrends")}
        </h2>
        <div className="relative">
          <button
            type="button"
            onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
            className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-card px-3 py-1.5 font-mono text-xs text-ink hover:bg-bg-3 transition-colors"
          >
            {selectedYear}
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
          {yearDropdownOpen && (
            <div
              className="absolute right-0 top-full z-10 mt-1 rounded-md border border-ink/10 bg-card py-1"
              style={{
                boxShadow:
                  "0 12px 24px -8px color-mix(in srgb, var(--color-ink) 18%, transparent)",
              }}
            >
              {years.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setSelectedYear(yr);
                    setYearDropdownOpen(false);
                  }}
                  className={`block w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-bg-3 ${
                    yr === selectedYear ? "text-ink font-mono" : "text-muted"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2" style={{ height: 200 }}>
        {Array.from({ length: 12 }).map((_, monthIdx) => {
          const amount = monthAmounts.get(monthIdx) ?? 0;
          const heightPct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
          const minHeight = amount > 0 ? 8 : 4;

          const isCurrentMonth =
            selectedYear === currentYear && monthIdx === currentMonth;
          const isFuture =
            selectedYear > currentYear ||
            (selectedYear === currentYear && monthIdx > currentMonth);

          let barStyle: React.CSSProperties = {
            background: "color-mix(in srgb, var(--color-ink) 15%, transparent)",
          };
          if (isCurrentMonth) {
            barStyle = { background: "var(--color-ink)" };
          }
          if (isFuture) {
            barStyle = {
              border:
                "1.5px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
              background: "transparent",
            };
          }

          return (
            <div
              key={monthIdx}
              className="flex flex-1 flex-col items-center gap-1"
            >
              {amount > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {Math.round(amount)}
                </span>
              )}
              <div
                className="w-full rounded-t transition-all"
                style={{
                  ...barStyle,
                  height: `${Math.max(heightPct, minHeight)}%`,
                  minHeight: `${minHeight}px`,
                }}
              />
              <span
                className={`mt-1 font-mono text-[11px] ${
                  isCurrentMonth ? "text-ink" : "text-muted"
                }`}
              >
                {monthLabels[monthIdx]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
