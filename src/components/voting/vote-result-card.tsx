"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { PdfDownloadButton } from "@/components/reports/pdf-download-button";
import type { MeetingVoteResult } from "@/lib/dal";

interface VoteResultCardProps {
  vote: MeetingVoteResult;
  canClose?: boolean;
  onClosed?: () => void;
}

const STATUS_PILL_BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider";

const BAR_COLORS = [
  "var(--color-moss)",
  "var(--color-danger)",
  "var(--color-ochre)",
  "var(--color-blue)",
  "var(--color-tile-a)",
];

export function VoteResultCard({ vote, canClose, onClosed }: VoteResultCardProps) {
  const t = useTranslations("voting");
  const confirm = useConfirm();
  const [closing, setClosing] = useState(false);

  const status =
    vote.status === "CLOSED"
      ? vote.passed
        ? {
            text: t("passed"),
            style: {
              background: "color-mix(in srgb, var(--color-good) 20%, transparent)",
              color: "var(--color-good)",
            },
          }
        : {
            text: t("defeated"),
            style: {
              background: "color-mix(in srgb, var(--color-danger) 18%, transparent)",
              color: "var(--color-danger)",
            },
          }
      : {
          text: t("voteOpen"),
          style: {
            background: "color-mix(in srgb, var(--color-blue) 20%, transparent)",
            color: "var(--color-blue)",
          },
        };

  async function handleClose() {
    const ok = await confirm({ title: t("confirmCloseVote"), danger: true });
    if (!ok) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/voting/votes/${vote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (res.ok) {
        toast.success(t("voteClosed"));
        onClosed?.();
      } else {
        const data = await res.json();
        toast.error(data.error || t("somethingWentWrong"));
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="font-display text-base text-ink leading-tight">{vote.title}</h4>
        <span className={STATUS_PILL_BASE} style={status.style}>
          {status.text}
        </span>
      </div>

      {/* Stacked bar */}
      {vote.totalWeight > 0 && (
        <div className="mb-3">
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-bg-3)" }}
          >
            {vote.options.map((opt, i) => {
              const pct = (opt.weight / vote.totalWeight) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={opt.id}
                  className="transition-all"
                  style={{
                    width: `${pct}%`,
                    background: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Option breakdown */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {vote.options.map((opt) => {
          const pct =
            vote.totalWeight > 0
              ? ((opt.weight / vote.totalWeight) * 100).toFixed(1)
              : "0.0";
          return (
            <span key={opt.id}>
              {opt.label}:{" "}
              <span className="font-mono text-ink">{pct}%</span>
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {vote.ballotCount} {t("ballotsCast")} · {t(`majorityType_${vote.majorityType}`)}
          {vote.status === "CLOSED" && " ·"}
        </span>

        <div className="flex items-center gap-2">
          <PdfDownloadButton
            kind="vote-result"
            refId={vote.id}
            label={t("downloadPdf")}
            title={t("downloadPdfTitle")}
            className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-bg-3 hover:text-ink transition-colors disabled:opacity-60"
          />

          {canClose && vote.status === "OPEN" && (
            <button
              onClick={handleClose}
              disabled={closing}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50"
              style={{
                border: "1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)",
                color: "var(--color-danger)",
              }}
            >
              <XCircle className="h-3 w-3" />
              {closing ? t("closingVote") : t("closeVote")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
