"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { DataTable, type Column } from "@/components/shared/data-table";

interface BudgetItem {
  accountId: string;
  name: string;
  plannedAmount: number;
  actualAmount: number;
}

interface BudgetTableProps {
  items: BudgetItem[];
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

function ProgressBar({
  item,
  t,
}: {
  item: BudgetItem;
  t: (k: string) => string;
}) {
  const pct =
    item.plannedAmount > 0
      ? Math.min((item.actualAmount / item.plannedAmount) * 100, 100)
      : 0;
  const isOverBudget =
    item.actualAmount > item.plannedAmount && item.plannedAmount > 0;
  const overPct = isOverBudget
    ? Math.min((item.actualAmount / item.plannedAmount) * 100, 150)
    : 0;
  return (
    <div>
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-full rounded-full"
          style={{
            background: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
          }}
        >
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${isOverBudget ? Math.min(overPct, 100) : pct}%`,
              background: isOverBudget
                ? "var(--color-danger)"
                : "var(--color-ink)",
            }}
          />
        </div>
        <span className="w-12 text-right font-mono text-[11px] text-muted">
          {Math.round(isOverBudget ? overPct : pct)}%
        </span>
      </div>
      {isOverBudget && (
        <span
          className="mt-0.5 block text-right font-mono text-[10.5px] uppercase tracking-wider"
          style={{ color: "var(--color-danger)" }}
        >
          {t("overBudget")}
        </span>
      )}
    </div>
  );
}

export function BudgetTable({ items, loading }: BudgetTableProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  const columns: Column<BudgetItem>[] = [
    {
      key: "category",
      header: t("category"),
      primary: true,
      render: (item) => <span className="text-sm text-ink">{item.name}</span>,
    },
    {
      key: "planned",
      header: t("planned"),
      align: "right",
      mono: true,
      render: (item) => (
        <span className="text-ink-soft">
          {formatCurrency(item.plannedAmount, locale)}
        </span>
      ),
    },
    {
      key: "actual",
      header: t("actual"),
      align: "right",
      mono: true,
      render: (item) => {
        const isOverBudget =
          item.actualAmount > item.plannedAmount && item.plannedAmount > 0;
        return (
          <span
            style={{
              color: isOverBudget
                ? "var(--color-danger)"
                : "var(--color-ink)",
            }}
          >
            {formatCurrency(item.actualAmount, locale)}
          </span>
        );
      },
    },
    {
      key: "progress",
      header: " ",
      render: (item) => <ProgressBar item={item} t={t} />,
    },
  ];

  return (
    <div className="rounded-xl border border-ink/8 bg-card overflow-hidden">
      <div className="border-b border-ink/8 px-6 py-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
          {t("budgetOverview")}
        </h3>
      </div>
      <DataTable
        rows={items}
        columns={columns}
        rowKey={(item) => item.accountId}
        loading={loading}
        emptyState={
          <div className="py-12 text-center text-sm text-muted">
            {t("noBudgetItems")}
          </div>
        }
        className="!rounded-none !border-0"
      />
    </div>
  );
}
