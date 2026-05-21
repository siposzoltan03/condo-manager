"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/shared/confirm-dialog";

/**
 * Action buttons on the contractor project-detail page. Drives the
 * forward-only status machine on the linked ticket:
 *   ASSIGNED → IN_PROGRESS → COMPLETED
 * VERIFIED is not user-driven from here — it's the board's sign-off
 * once they mark the invoice paid.
 */
export function ProjectActions({
  bidId,
  ticketStatus,
}: {
  bidId: string;
  ticketStatus: string;
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const confirm = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart = ticketStatus === "ASSIGNED";
  const canComplete = ticketStatus === "IN_PROGRESS";

  if (!canStart && !canComplete) return null;

  async function advance(next: "IN_PROGRESS" | "COMPLETED") {
    const ok = await confirm({
      title:
        next === "IN_PROGRESS"
          ? t("projectActionStartConfirmTitle")
          : t("projectActionCompleteConfirmTitle"),
      description:
        next === "IN_PROGRESS"
          ? t("projectActionStartConfirm")
          : t("projectActionCompleteConfirm"),
      confirmLabel: t("projectActionConfirmYes"),
      cancelLabel: t("projectActionConfirmCancel"),
    });
    if (!ok) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contractor/projects/${bidId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          reason?: string;
        } | null;
        setError(
          data?.reason === "INVALID_TRANSITION"
            ? t("projectActionInvalidTransition")
            : t("projectActionFailed"),
        );
        return;
      }
      router.refresh();
    } catch {
      setError(t("projectActionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: "var(--color-bg-3)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <span
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "10px",
        }}
      >
        {t("projectActionsHeading")}
      </span>

      {error && (
        <div
          role="alert"
          className="rounded-md border"
          style={{
            padding: "8px 12px",
            marginBottom: "10px",
            fontSize: "12.5px",
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      {canStart && (
        <button
          type="button"
          onClick={() => advance("IN_PROGRESS")}
          disabled={submitting}
          className="w-full disabled:opacity-60"
          style={{
            padding: "11px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            letterSpacing: "0.02em",
          }}
        >
          {submitting ? "…" : t("projectActionStart")}
        </button>
      )}
      {canComplete && (
        <button
          type="button"
          onClick={() => advance("COMPLETED")}
          disabled={submitting}
          className="w-full disabled:opacity-60"
          style={{
            padding: "11px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: "var(--color-good)",
            color: "var(--color-bg)",
            letterSpacing: "0.02em",
          }}
        >
          {submitting ? "…" : t("projectActionComplete")}
        </button>
      )}
    </section>
  );
}
