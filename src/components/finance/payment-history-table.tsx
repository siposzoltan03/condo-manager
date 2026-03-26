"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface Charge {
  id: string;
  month: string;
  amount: string | number;
  dueDate: string | null;
  paidAt: string | null;
  status: string;
  invoiceId: string | null;
}

interface PaymentHistoryTableProps {
  charges: Charge[];
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

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

function formatMonth(monthStr: string, locale: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    PAID: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", label: t("paid") },
    OVERDUE: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500", label: t("overdue") },
    UNPAID: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", label: t("pending") },
  };

  const c = config[status] ?? config.UNPAID;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function PaymentHistoryTable({
  charges,
  total,
  page,
  totalPages,
  onPageChange,
  loading,
}: PaymentHistoryTableProps) {
  const t = useTranslations("finance");
  const locale = useLocale();

  const escapeCsvField = (field: string): string => {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const handleExportCsv = () => {
    const headers = [t("month"), t("amount"), t("dueDate"), t("paidDate"), t("status")];
    const rows = charges.map((c) => [
      c.month,
      String(c.amount),
      c.dueDate ?? "",
      c.paidAt ?? "",
      c.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsvField).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6">
        <h2 className="text-lg font-bold text-[#002045]">{t("financialHistory")}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-lg bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#003060]"
          >
            <Download className="h-4 w-4" />
            {t("exportCsv")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="space-y-4 p-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : charges.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#515f74]">{t("noCharges")}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-8 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("month")}
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("amount")}
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("dueDate")}
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("paidDate")}
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("status")}
                </th>
                <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[#515f74]">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr
                  key={charge.id}
                  className="border-b border-gray-50 transition-colors hover:bg-gray-50"
                >
                  <td className="px-8 py-4">
                    <p className="font-bold text-[#002045]">{formatMonth(charge.month, locale)}</p>
                    {charge.invoiceId && (
                      <p className="mt-0.5 text-xs text-[#515f74]">{charge.invoiceId}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#002045]">
                    {formatCurrency(charge.amount, locale)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#515f74]">
                    {formatDate(charge.dueDate, locale)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#515f74]">
                    {formatDate(charge.paidAt, locale)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={charge.status} t={t} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[#515f74] transition-colors hover:bg-gray-100 hover:text-[#002045]"
                      title="Receipt"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-8 py-4">
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
