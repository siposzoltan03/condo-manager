"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

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

export function BudgetTable({ items, loading }: BudgetTableProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  if (loading) {
    return (
      <div className="rounded-xl bg-white border border-gray-100">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-gray-100">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-bold text-[#002045]">{t("budgetOverview")}</h3>
      </div>
      {items.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#515f74]">{t("noBudgetItems")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("category")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("planned")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("actual")}
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const pct = item.plannedAmount > 0
                  ? Math.min((item.actualAmount / item.plannedAmount) * 100, 100)
                  : 0;
                const isOverBudget = item.actualAmount > item.plannedAmount && item.plannedAmount > 0;
                const overPct = isOverBudget
                  ? Math.min((item.actualAmount / item.plannedAmount) * 100, 150)
                  : 0;

                return (
                  <tr key={item.accountId} className="border-b border-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-[#002045]">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#515f74]">
                      {formatCurrency(item.plannedAmount, locale)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${isOverBudget ? "text-red-600" : "text-[#002045]"}`}>
                      {formatCurrency(item.actualAmount, locale)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-full rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full transition-all ${isOverBudget ? "bg-red-500" : "bg-[#002045]"}`}
                            style={{ width: `${isOverBudget ? Math.min(overPct, 100) : pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs text-[#515f74]">
                          {Math.round(isOverBudget ? overPct : pct)}%
                        </span>
                      </div>
                      {isOverBudget && (
                        <span className="mt-0.5 block text-right text-xs text-red-500">{t("overBudget")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
