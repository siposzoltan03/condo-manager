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

interface CardConfig {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** CSS color expression (token or color-mix). */
  iconColor: string;
  /** CSS color expression for the soft background ring around the icon. */
  iconBg: string;
}

export function BudgetSummaryCards({ summary, loading }: BudgetSummaryCardsProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-ink/8 bg-card p-6"
          >
            <div className="h-4 w-20 rounded bg-bg-3" />
            <div className="mt-4 h-8 w-28 rounded bg-bg-3" />
          </div>
        ))}
      </div>
    );
  }

  const cards: CardConfig[] = [
    {
      label: t("currentFund"),
      value: summary?.currentFundBalance ?? 0,
      icon: Wallet,
      iconColor: "var(--color-blue)",
      iconBg: "color-mix(in srgb, var(--color-blue) 14%, transparent)",
    },
    {
      label: t("reserveFund"),
      value: summary?.reserveFundBalance ?? 0,
      icon: ShieldCheck,
      iconColor: "var(--color-moss)",
      iconBg: "color-mix(in srgb, var(--color-moss) 16%, transparent)",
    },
    {
      label: t("totalIncomeYtd"),
      value: summary?.totalIncome ?? 0,
      icon: TrendingUp,
      iconColor: "var(--color-good)",
      iconBg: "color-mix(in srgb, var(--color-good) 16%, transparent)",
    },
    {
      label: t("totalExpensesYtd"),
      value: summary?.totalExpenses ?? 0,
      icon: TrendingDown,
      iconColor: "var(--color-danger)",
      iconBg: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-ink/8 bg-card p-6"
          >
            <div
              className="inline-flex items-center justify-center rounded-full p-2.5"
              style={{ background: card.iconBg }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: card.iconColor }}
              />
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted">
              {card.label}
            </p>
            <p className="mt-1 font-display text-2xl text-ink leading-tight">
              {formatCurrency(card.value, locale)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
