"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

interface DocumentFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  visibilityFilter: string;
  onVisibilityChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  fullTextSearch: boolean;
  onFullTextToggle: (value: boolean) => void;
}

export function DocumentFilters({
  searchValue,
  onSearchChange,
  visibilityFilter,
  onVisibilityChange,
  typeFilter,
  onTypeChange,
  fullTextSearch,
  onFullTextToggle,
}: DocumentFiltersProps) {
  const t = useTranslations("documents");

  return (
    <div className="rounded-2xl bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-xl bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002045]/20"
          />
        </div>

        {/* Full-text toggle */}
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={fullTextSearch}
            onChange={(e) => onFullTextToggle(e.target.checked)}
            className="rounded border-slate-300 text-[#002045] focus:ring-[#002045]/20"
          />
          {t("fullText")}
        </label>

        {/* Visibility filter */}
        <select
          value={visibilityFilter}
          onChange={(e) => onVisibilityChange(e.target.value)}
          className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#002045]/20"
        >
          <option value="">{t("allVisibility")}</option>
          <option value="PUBLIC">{t("visibilityPublic")}</option>
          <option value="BOARD_ONLY">{t("visibilityBoardOnly")}</option>
          <option value="ADMIN_ONLY">{t("visibilityAdminOnly")}</option>
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeChange(e.target.value)}
          className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#002045]/20"
        >
          <option value="">{t("allTypes")}</option>
          <option value="PDF">PDF</option>
          <option value="DOCX">DOCX</option>
          <option value="XLSX">XLSX</option>
        </select>

        {/* Filter button */}
        <button className="rounded-xl bg-slate-50 p-2.5 text-slate-600 hover:bg-slate-100 transition-colors">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
