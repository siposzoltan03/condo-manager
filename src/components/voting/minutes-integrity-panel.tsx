"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, ShieldCheck, ShieldAlert, Send, AlertTriangle } from "lucide-react";
import { sealMeetingMinutes, distributeMeetingMinutes } from "@/app/actions/voting";
import type { MeetingDetailData } from "@/lib/dal";

interface Props {
  meetingId: string;
  /** All three § 39 signatures present — required before sealing. */
  executed: boolean;
  canManage: boolean;
  integrity: MeetingDetailData["minutesIntegrity"];
  delivery: MeetingDetailData["minutesDelivery"];
}

/**
 * Jegyzőkönyv integrity + Tht. § 43 delivery controls: seal the executed
 * minutes (freeze a content hash), then distribute (record § 43/A board
 * posting + queue § 33/A owner emails). Surfaces tamper ("modified since
 * sealing") and overdue-delivery warnings.
 */
export function MinutesIntegrityPanel({
  meetingId,
  executed,
  canManage,
  integrity,
  delivery,
}: Props) {
  const t = useTranslations("voting");
  const router = useRouter();
  const [busy, setBusy] = useState<"seal" | "distribute" | null>(null);

  async function run(kind: "seal" | "distribute", fn: () => Promise<{ success?: boolean; error?: string }>) {
    setBusy(kind);
    try {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "seal" ? t("minutesSealed") : t("minutesDistributed"));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const tampered = integrity.sealed && !integrity.matches;

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
          {t("minutesIntegrityTitle")}
        </h3>
      </div>

      {/* Seal status */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/8 px-3 py-2.5">
        <div className="min-w-0">
          {integrity.sealed ? (
            <>
              <div className="flex items-center gap-1.5">
                {tampered ? (
                  <ShieldAlert className="h-3.5 w-3.5" style={{ color: "var(--color-danger)" }} />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--color-good)" }} />
                )}
                <span className="text-sm text-ink">
                  {t("minutesSealedVersion", { n: integrity.versionNumber ?? 0 })}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-muted">
                {t("minutesHash")}: {integrity.contentHashShort}…
              </p>
              {tampered && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                  {t("minutesModifiedSinceSeal")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">{t("minutesNotSealed")}</p>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => run("seal", () => sealMeetingMinutes(meetingId))}
            disabled={busy !== null || !executed}
            title={!executed ? t("minutesSealNeedsSignatures") : undefined}
            className="shrink-0 rounded-md bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {busy === "seal" ? t("signing") : tampered ? t("minutesReseal") : t("minutesSeal")}
          </button>
        )}
      </div>

      {/* Delivery status */}
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-ink/8 px-3 py-2.5">
        <div className="min-w-0">
          {delivery.distributed ? (
            <div className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" style={{ color: "var(--color-good)" }} />
              <span className="text-sm text-ink">
                {t("minutesDistributedCount", { n: delivery.deliveredCount })}
              </span>
            </div>
          ) : delivery.overdue ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--color-danger)" }} />
              <span className="text-sm" style={{ color: "var(--color-danger)" }}>
                {t("minutesDeliveryOverdue")}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("minutesNotDistributed")}</p>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => run("distribute", () => distributeMeetingMinutes(meetingId))}
            disabled={busy !== null || !integrity.sealed}
            title={!integrity.sealed ? t("minutesDistributeNeedsSeal") : undefined}
            className="shrink-0 rounded-md border border-ink/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-ink/5 disabled:opacity-40 transition-colors"
          >
            {busy === "distribute" ? t("signing") : t("minutesDistribute")}
          </button>
        )}
      </div>
    </div>
  );
}
