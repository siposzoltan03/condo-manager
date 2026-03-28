"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

const STATUSES = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
];

const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "COMMON_AREA",
  "ELEVATOR",
  "HEATING",
  "OTHER",
];

interface TicketFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  urgencyFilter: string;
  onUrgencyChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
}

export function TicketFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  urgencyFilter,
  onUrgencyChange,
  categoryFilter,
  onCategoryChange,
}: TicketFilterBarProps) {
  const t = useTranslations("maintenance");

  return (
    <div className="mb-6 rounded-xl bg-slate-50 p-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("search")}
            className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        >
          <option value="">{t("filterStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status_${s}`)}
            </option>
          ))}
        </select>

        <select
          value={urgencyFilter}
          onChange={(e) => onUrgencyChange(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        >
          <option value="">{t("filterUrgency")}</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {t(`urgency_${u}`)}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        >
          <option value="">{t("filterCategory")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category_${c}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
