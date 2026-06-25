"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";

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
  total: _total,
  page,
  totalPages,
  onPageChange,
  loading,
}: LedgerTableProps) {
  const t = useTranslations("finance");
  const locale = useLocale();
  void _total;

  const columns: Column<LedgerEntry>[] = [
    {
      key: "date",
      header: t("date"),
      align: "left",
      mono: true,
      render: (entry) => (
        <span className="whitespace-nowrap text-[11px] text-muted">
          {formatDate(entry.date, locale)}
        </span>
      ),
    },
    {
      key: "description",
      header: t("description"),
      primary: true,
      render: (entry) => (
        <div>
          <p className="text-sm text-ink">{entry.description}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <span
              className="inline-flex rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
              style={{
                background:
                  "color-mix(in srgb, var(--color-blue) 14%, transparent)",
                color: "var(--color-blue)",
              }}
            >
              {entry.debitAccount.name}
            </span>
            <span
              className="inline-flex rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
              style={{
                background:
                  "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                color: "var(--color-ink-soft)",
              }}
            >
              {entry.creditAccount.name}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "debit",
      header: t("debit"),
      align: "right",
      mono: true,
      render: (entry) => (
        <span style={{ color: "var(--color-danger)" }}>
          {formatCurrency(entry.amount, locale)}
        </span>
      ),
    },
    {
      key: "credit",
      header: t("credit"),
      align: "right",
      mono: true,
      render: (entry) => (
        <span style={{ color: "var(--color-good)" }}>
          {formatCurrency(entry.amount, locale)}
        </span>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-ink/8 bg-card overflow-hidden">
      <div className="border-b border-ink/8 px-6 py-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
          {t("ledgerEntries")}
        </h3>
      </div>

      <DataTable
        rows={entries}
        columns={columns}
        rowKey={(e) => e.id}
        loading={loading}
        emptyState={
          <div className="py-12 text-center text-sm text-muted">
            {t("noEntries")}
          </div>
        }
        className="!rounded-none !border-0"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-ink/8 px-6 py-3">
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
