"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PdfDownloadButton } from "./pdf-download-button";

const MONTHS_HU = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
];

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function lastNMonths(n: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const value = `${y}-${String(m).padStart(2, "0")}`;
    const labelHu = `${y}. ${MONTHS_HU[m - 1]}`;
    const labelEn = `${MONTHS_EN[m - 1]} ${y}`;
    // We let next-intl pick the locale via Intl, but a simple HU-first label
    // is fine because the picker is only shown to board members on the
    // finance page (Hungarian-leaning UI).
    void labelEn;
    out.push({ value, label: labelHu });
  }
  return out;
}

interface Props {
  className?: string;
  buttonClassName?: string;
}

/**
 * Month-picker + PDF generate button for the monthly finance summary.
 *
 * Defaults to the previous (most recently completed) calendar month. We
 * skip the in-progress current month because its KPIs are unstable and
 * users typically want a closed period.
 */
export function MonthlyFinancePdfButton({ className, buttonClassName }: Props) {
  const t = useTranslations("finance");
  const months = lastNMonths(13);
  // Default = previous month (index 1). months[0] is the in-progress month.
  const [period, setPeriod] = useState<string>(months[1]?.value ?? months[0].value);

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <label
        htmlFor="finance-pdf-period"
        className="font-mono text-[11px] uppercase tracking-wider text-muted"
      >
        {t("pdfPeriodLabel")}
      </label>
      <select
        id="finance-pdf-period"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="rounded-md border border-ink/15 bg-card px-2.5 py-1.5 text-sm text-ink"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <PdfDownloadButton
        kind="finance-summary"
        refId={period}
        label={t("downloadFinancePdf")}
        title={t("downloadFinancePdfTitle")}
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity disabled:opacity-60"
        }
      />
    </div>
  );
}
