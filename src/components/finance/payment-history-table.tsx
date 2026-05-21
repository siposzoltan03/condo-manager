"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";

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

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  PAID: {
    background: "color-mix(in srgb, var(--color-good) 18%, transparent)",
    color: "var(--color-good)",
  },
  OVERDUE: {
    background: "color-mix(in srgb, var(--color-danger) 16%, transparent)",
    color: "var(--color-danger)",
  },
  UNPAID: {
    background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
    color: "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
  },
};

const STATUS_DOT: Record<string, string> = {
  PAID: "var(--color-good)",
  OVERDUE: "var(--color-danger)",
  UNPAID: "var(--color-ochre)",
};

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.UNPAID;
  const dotColor = STATUS_DOT[status] ?? STATUS_DOT.UNPAID;
  const label =
    status === "PAID"
      ? t("paid")
      : status === "OVERDUE"
        ? t("overdue")
        : t("pending");
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider"
      style={style}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: dotColor }}
      />
      {label}
    </span>
  );
}

export function PaymentHistoryTable({
  charges,
  total: _total,
  page,
  totalPages,
  onPageChange,
  loading,
}: PaymentHistoryTableProps) {
  const t = useTranslations("finance");
  const locale = useLocale();
  void _total;

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
    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsvField).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<Charge>[] = [
    {
      key: "month",
      header: t("month"),
      primary: true,
      render: (c) => (
        <div>
          <p className="text-sm text-ink">{formatMonth(c.month, locale)}</p>
          {c.invoiceId && (
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {c.invoiceId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: t("amount"),
      mono: true,
      render: (c) => (
        <span className="text-ink">{formatCurrency(c.amount, locale)}</span>
      ),
    },
    {
      key: "dueDate",
      header: t("dueDate"),
      mono: true,
      render: (c) => (
        <span className="text-[11px] text-muted">{formatDate(c.dueDate, locale)}</span>
      ),
    },
    {
      key: "paidDate",
      header: t("paidDate"),
      mono: true,
      render: (c) => (
        <span className="text-[11px] text-muted">{formatDate(c.paidAt, locale)}</span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      render: (c) => <StatusBadge status={c.status} t={t} />,
    },
  ];

  return (
    <div className="rounded-xl border border-ink/8 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-ink/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
        <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
          {t("financialHistory")}
        </h2>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity sm:min-h-0 sm:self-auto"
        >
          <Download className="h-4 w-4" />
          {t("exportCsv")}
        </button>
      </div>

      <DataTable
        rows={charges}
        columns={columns}
        rowKey={(c) => c.id}
        loading={loading}
        emptyState={
          <div className="py-16 text-center text-sm text-muted">
            {t("noCharges")}
          </div>
        }
        rowActions={() => (
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-3 hover:text-ink sm:h-9 sm:w-9"
            title={t("receipt")}
            aria-label={t("receipt")}
          >
            <FileText className="h-4 w-4" />
          </button>
        )}
        className="!rounded-none !border-0"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink/8 px-4 py-3 sm:px-8">
          <p className="font-mono text-[11px] text-muted">
            {t("pageOf", { page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-ink/15 bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-bg-3 disabled:opacity-50 transition-colors sm:min-h-0"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-ink/15 bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-bg-3 disabled:opacity-50 transition-colors sm:min-h-0"
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
