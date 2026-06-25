"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PdfDownloadButton } from "./pdf-download-button";

function recentYears(n: number): number[] {
  const cur = new Date().getFullYear();
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(cur - i);
  return out;
}

interface Props {
  className?: string;
  buttonClassName?: string;
}

/**
 * Year-picker + PDF generate button for the annual elszámolás.
 *
 * Default = current calendar year. (We don't shift to the prior year as
 * the finance-summary button does — board members often pull a fresh
 * year-to-date elszámolás partway through the year.)
 */
export function YearEndPdfButton({ className, buttonClassName }: Props) {
  const t = useTranslations("finance");
  const years = recentYears(5);
  const [year, setYear] = useState<string>(String(years[0]));

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <label
        htmlFor="finance-year-pdf"
        className="font-mono text-[11px] uppercase tracking-wider text-muted"
      >
        {t("pdfYearLabel")}
      </label>
      <select
        id="finance-year-pdf"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="rounded-md border border-ink/15 bg-card px-2.5 py-1.5 text-sm text-ink"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <PdfDownloadButton
        kind="year-end-account"
        refId={year}
        label={t("downloadYearEndPdf")}
        title={t("downloadYearEndPdfTitle")}
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-card px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors disabled:opacity-60"
        }
      />
    </div>
  );
}
