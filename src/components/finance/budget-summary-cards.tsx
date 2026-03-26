"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Wallet, ShieldCheck, TrendingUp, TrendingDown } from "lucide-react";

interface FinanceSummary {
  currentFundBalance: number;
  reserveFundBalance: number;
  totalIncome: number;
  totalExpenses: number;
}

interface BudgetSummaryCardsProps {
  summary: FinanceSummary | null;
  loading?: boolean;
}

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "hu" ? "hu-HU" : "en-US", {
    style: "currency",
    currency: locale === "hu" ? "HUF" : "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function BudgetSummaryCards({ summary, loading }: BudgetSummaryCardsProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-white p-6">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="mt-4 h-8 w-28 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: t("currentFund"),
      value: summary?.currentFundBalance ?? 0,
      icon: Wallet,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      badge: summary && summary.currentFundBalance > 0 ? "+12%" : null,
    },
    {
      label: t("reserveFund"),
      value: summary?.reserveFundBalance ?? 0,
      icon: ShieldCheck,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      badge: null,
    },
    {
      label: t("totalIncomeYtd"),
      value: summary?.totalIncome ?? 0,
      icon: TrendingUp,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      badge: null,
    },
    {
      label: t("totalExpensesYtd"),
      value: summary?.totalExpenses ?? 0,
      icon: TrendingDown,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      badge: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-gray-100 bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <div className={`inline-flex items-center justify-center rounded-full p-2.5 ${card.iconBg}`}>
                <Icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              {card.badge && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  {card.badge}
                </span>
              )}
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-[#515f74]">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#002045]">
              {formatCurrency(card.value, locale)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
