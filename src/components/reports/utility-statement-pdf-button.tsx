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

function lastNMonths(n: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    out.push({
      value: `${y}-${String(m).padStart(2, "0")}`,
      label: `${y}. ${MONTHS_HU[m - 1]}`,
    });
  }
  return out;
}

interface Props {
  className?: string;
  buttonClassName?: string;
}

/**
 * Month-picker + PDF generate button for the rezsicsökkentési kimutatás.
 *
 * Defaults to the previous (most recently completed) calendar month, like
 * the finance-summary button. Tht. § 43/A expects this to be posted on
 * the notice-board within the first half of the following month.
 */
export function UtilityStatementPdfButton({
  className,
  buttonClassName,
}: Props) {
  const t = useTranslations("finance");
  const months = lastNMonths(13);
  const [period, setPeriod] = useState<string>(
    months[1]?.value ?? months[0].value,
  );

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <label
        htmlFor="utility-pdf-period"
        className="font-mono text-[11px] uppercase tracking-wider text-muted"
      >
        {t("pdfPeriodLabel")}
      </label>
      <select
        id="utility-pdf-period"
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
        kind="utility-statement"
        refId={period}
        label={t("downloadUtilityPdf")}
        title={t("downloadUtilityPdfTitle")}
        className={
          buttonClassName ??
          "inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-card px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors disabled:opacity-60"
        }
      />
    </div>
  );
}
