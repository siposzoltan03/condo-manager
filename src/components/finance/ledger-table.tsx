"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: string | number;
  debitAccount: { name: string };
  creditAccount: { name: string };
  createdBy: { name: string } | null;
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

export function LedgerTable({
  entries,
  total,
  page,
  totalPages,
  onPageChange,
  loading,
}: LedgerTableProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  if (loading) {
    return (
      <div className="rounded-xl bg-white border border-gray-100">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-gray-100">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-bold text-[#002045]">{t("ledgerEntries")}</h3>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#515f74]">{t("noEntries")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("date")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("description")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("debit")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("credit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-[#515f74]">
                    {formatDate(entry.date, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-[#002045]">{entry.description}</p>
                    <div className="mt-0.5 flex gap-1.5">
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {entry.debitAccount.name}
                      </span>
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {entry.creditAccount.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                    {formatCurrency(entry.amount, locale)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                    {formatCurrency(entry.amount, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
          <p className="text-sm text-[#515f74]">
            {t("pageOf", { page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#515f74] hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#515f74] hover:bg-gray-50 disabled:opacity-50"
            >
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
