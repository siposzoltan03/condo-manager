"use client";

import { useTranslations, useLocale } from "next-intl";

interface StatusChange {
  status: string;
  date: string;
  changedBy?: string;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  SUBMITTED: "bg-slate-400",
  UNDER_REVIEW: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
  REJECTED: "bg-red-500",
};

interface StatusTimelineProps {
  changes: StatusChange[];
}

export function StatusTimeline({ changes }: StatusTimelineProps) {
  const t = useTranslations("complaints");
  const locale = useLocale();

  if (changes.length === 0) return null;

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 h-[calc(100%-24px)] w-0.5 bg-slate-200" />
      <ul className="space-y-4">
        {changes.map((change, i) => {
          const dotColor = STATUS_DOT_COLORS[change.status] ?? "bg-slate-400";
          const date = new Date(change.date).toLocaleString(locale);

          return (
            <li key={i} className="relative flex gap-3 pl-0">
              <div
                className={`relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full ${dotColor} flex items-center justify-center`}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {t(`status_${change.status}`)}
                </p>
                <p className="text-xs text-slate-500">
                  {date}
                  {change.changedBy && ` — ${change.changedBy}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
