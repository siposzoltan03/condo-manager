"use client";

import { useTranslations } from "next-intl";
import { Plus, Upload, FileBarChart } from "lucide-react";

interface BudgetActionBarProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onAddExpense: () => void;
  onAddIncome: () => void;
  onImportStatement: () => void;
  onGenerateReport: () => void;
}

export function BudgetActionBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onAddExpense,
  onAddIncome,
  onImportStatement,
  onGenerateReport,
}: BudgetActionBarProps) {
  const t = useTranslations("finance");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/8 bg-card p-4">
      {/* Date range */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="finance-from-date"
          className="font-mono text-[11px] uppercase tracking-wider text-muted"
        >
          {t("fromDate")}
        </label>
        <input
          id="finance-from-date"
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          className="rounded-md border border-ink/15 bg-card px-3 py-1.5 text-sm text-ink"
        />
      </div>
      <div className="flex items-center gap-2">
        <label
          htmlFor="finance-to-date"
          className="font-mono text-[11px] uppercase tracking-wider text-muted"
        >
          {t("toDate")}
        </label>
        <input
          id="finance-to-date"
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          className="rounded-md border border-ink/15 bg-card px-3 py-1.5 text-sm text-ink"
        />
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <button
        type="button"
        onClick={onAddExpense}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors min-h-11 sm:min-h-0"
      >
        <Plus className="h-4 w-4" />
        {t("addExpense")}
      </button>
      <button
        type="button"
        onClick={onAddIncome}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors min-h-11 sm:min-h-0"
      >
        <Plus className="h-4 w-4" />
        {t("addIncome")}
      </button>
      <button
        type="button"
        onClick={onImportStatement}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors min-h-11 sm:min-h-0"
      >
        <Upload className="h-4 w-4" />
        {t("importStatement")}
      </button>
      <button
        type="button"
        onClick={onGenerateReport}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity min-h-11 sm:min-h-0"
      >
        <FileBarChart className="h-4 w-4" />
        {t("generateReport")}
      </button>
    </div>
  );
}
