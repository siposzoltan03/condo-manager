"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PdfDownloadButton } from "./pdf-download-button";

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  className?: string;
  buttonClassName?: string;
}

/**
 * Date-range picker + PDF generate button for the audit-slice export.
 *
 * Default range: last 30 days. Restricts each end to a maximum of 1 year
 * back so callers don't accidentally pull tens of thousands of rows.
 */
export function AuditSlicePdfButton({ className, buttonClassName }: Props) {
  const t = useTranslations("admin");
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const refId = `${from}_${to}`;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(to) &&
    from <= to;

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      <label
        htmlFor="audit-from"
        className="font-mono text-[11px] uppercase tracking-wider text-muted"
      >
        {t("auditFrom")}
      </label>
      <input
        id="audit-from"
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-md border border-ink/15 bg-card px-2.5 py-1.5 text-sm text-ink"
      />
      <label
        htmlFor="audit-to"
        className="font-mono text-[11px] uppercase tracking-wider text-muted"
      >
        {t("auditTo")}
      </label>
      <input
        id="audit-to"
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="rounded-md border border-ink/15 bg-card px-2.5 py-1.5 text-sm text-ink"
      />
      {valid ? (
        <PdfDownloadButton
          kind="audit-slice"
          refId={refId}
          label={t("downloadAuditPdf")}
          title={t("downloadAuditPdfTitle")}
          className={
            buttonClassName ??
            "inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity disabled:opacity-60"
          }
        />
      ) : (
        <span className="font-mono text-[11px] text-muted">
          {t("auditInvalidRange")}
        </span>
      )}
    </div>
  );
}
