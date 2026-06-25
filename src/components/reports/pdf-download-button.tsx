"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface PdfDownloadButtonProps {
  kind:
    | "vote-result"
    | "meeting-summary"
    | "finance-summary"
    | "year-end-account"
    | "utility-statement"
    | "minutes"
    | "audit-slice";
  refId: string;
  /** Display label inside the button. */
  label: string;
  /** Tooltip / aria-label. */
  title?: string;
  className?: string;
}

/**
 * Triggers PDF generation via the queue + opens the rendered file when
 * ready. Polls `/api/reports/{id}/status` every second up to 30 s. If
 * the report is already cached, the very first status call returns
 * READY and we open the download URL immediately — the user perceives
 * a normal click-then-download.
 */
export function PdfDownloadButton({
  kind,
  refId,
  label,
  title,
  className,
}: PdfDownloadButtonProps) {
  const t = useTranslations("voting");
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  const onClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    cancelledRef.current = false;
    const toastId = toast.loading(t("pdfPreparing"));

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, refId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { reportId } = (await res.json()) as { reportId: string };

      // Poll status. 1 s interval, 30 s ceiling.
      const startedAt = Date.now();
      while (!cancelledRef.current) {
        if (Date.now() - startedAt > 30_000) {
          throw new Error(t("pdfTimeout"));
        }
        const sRes = await fetch(`/api/reports/${reportId}/status`);
        if (!sRes.ok) {
          throw new Error(`Status check failed: HTTP ${sRes.status}`);
        }
        const sBody = (await sRes.json()) as {
          status: "PENDING" | "RUNNING" | "READY" | "FAILED";
          downloadUrl: string | null;
          errorMessage: string | null;
        };
        if (sBody.status === "READY" && sBody.downloadUrl) {
          toast.dismiss(toastId);
          toast.success(t("pdfReady"));
          window.open(sBody.downloadUrl, "_blank", "noopener,noreferrer");
          return;
        }
        if (sBody.status === "FAILED") {
          throw new Error(sBody.errorMessage || t("pdfFailed"));
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error ? err.message : t("pdfFailed"));
    } finally {
      setBusy(false);
    }
  }, [busy, kind, refId, t]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      className={className}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span aria-hidden>📄</span>
      )}
      <span>{label}</span>
    </button>
  );
}
