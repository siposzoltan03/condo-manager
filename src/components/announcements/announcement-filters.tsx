"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

interface AnnouncementFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  audienceFilter: string;
  onAudienceChange: (value: string) => void;
}

export function AnnouncementFilters({
  searchValue,
  onSearchChange,
  audienceFilter,
  onAudienceChange,
}: AnnouncementFiltersProps) {
  const t = useTranslations("announcements");

  return (
    <div className="rounded-2xl bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("filterPlaceholder")}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002045]/20"
          />
        </div>

        {/* Audience filter */}
        <select
          value={audienceFilter}
          onChange={(e) => onAudienceChange(e.target.value)}
          className="rounded-xl border-0 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002045]/20"
        >
          <option value="">{t("allAudiences")}</option>
          <option value="ALL">{t("audienceAll")}</option>
          <option value="BOARD_ONLY">{t("audienceBoardOnly")}</option>
        </select>
      </div>
    </div>
  );
}
