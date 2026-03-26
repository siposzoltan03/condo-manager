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
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_KEYS_HU = [
  "Jan", "Feb", "Már", "Ápr", "Máj", "Jún",
  "Júl", "Aug", "Szep", "Okt", "Nov", "Dec",
];

export function PaymentTrendsChart({ charges, loading }: PaymentTrendsChartProps) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  const monthLabels = locale === "hu" ? MONTH_KEYS_HU : MONTH_KEYS;

  // Build a map of month -> amount for the selected year
  const monthAmounts = new Map<number, number>();
  for (const charge of charges) {
    const [yearStr, monthStr] = charge.month.split("-");
    if (parseInt(yearStr) === selectedYear) {
      const monthIdx = parseInt(monthStr) - 1;
      const amt = typeof charge.amount === "string" ? parseFloat(charge.amount) : charge.amount;
      monthAmounts.set(monthIdx, (monthAmounts.get(monthIdx) ?? 0) + amt);
    }
  }

  const maxAmount = Math.max(...Array.from(monthAmounts.values()), 1);
  const years = [currentYear - 1, currentYear, currentYear + 1];

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-8">
        <div className="animate-pulse">
          <div className="h-6 w-40 rounded bg-gray-200" />
          <div className="mt-6 flex items-end gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1">
                <div
                  className="rounded-t bg-gray-200"
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
    <div className="rounded-xl bg-white p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#002045]">{t("monthlyTrends")}</h2>
        <div className="relative">
          <button
            type="button"
            onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-[#002045] hover:bg-gray-50"
          >
            {selectedYear}
            <ChevronDown className="h-4 w-4" />
          </button>
          {yearDropdownOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {years.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setSelectedYear(yr);
                    setYearDropdownOpen(false);
                  }}
                  className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                    yr === selectedYear ? "font-bold text-[#002045]" : "text-gray-600"
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

          const isCurrentMonth = selectedYear === currentYear && monthIdx === currentMonth;
          const isFuture =
            selectedYear > currentYear ||
            (selectedYear === currentYear && monthIdx > currentMonth);
          const isPast = !isCurrentMonth && !isFuture;

          let barClass = "bg-[#adc7f7]"; // past
          if (isCurrentMonth) barClass = "bg-[#002045]";
          if (isFuture) barClass = "border-2 border-dashed border-[#e2e7ff] bg-[#e2e7ff]";

          return (
            <div key={monthIdx} className="flex flex-1 flex-col items-center gap-1">
              {amount > 0 && (
                <span className="text-xs text-[#515f74]">
                  {Math.round(amount)}
                </span>
              )}
              <div
                className={`w-full rounded-t ${barClass} transition-all`}
                style={{
                  height: `${Math.max(heightPct, minHeight)}%`,
                  minHeight: `${minHeight}px`,
                }}
              />
              <span
                className={`mt-1 text-xs ${
                  isCurrentMonth ? "font-bold text-[#002045]" : "text-[#515f74]"
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
