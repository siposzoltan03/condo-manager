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
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 border border-gray-100">
      {/* Date range */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[#515f74]">{t("fromDate")}</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-[#002045]"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[#515f74]">{t("toDate")}</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-[#002045]"
        />
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <button
        type="button"
        onClick={onAddExpense}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#002045] hover:bg-gray-50"
      >
        <Plus className="h-4 w-4" />
        {t("addExpense")}
      </button>
      <button
        type="button"
        onClick={onAddIncome}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#002045] hover:bg-gray-50"
      >
        <Plus className="h-4 w-4" />
        {t("addIncome")}
      </button>
      <button
        type="button"
        onClick={onImportStatement}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#002045] hover:bg-gray-50"
      >
        <Upload className="h-4 w-4" />
        {t("importStatement")}
      </button>
      <button
        type="button"
        onClick={onGenerateReport}
        className="flex items-center gap-1.5 rounded-lg bg-[#002045] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#003060]"
      >
        <FileBarChart className="h-4 w-4" />
        {t("generateReport")}
      </button>
    </div>
  );
}
