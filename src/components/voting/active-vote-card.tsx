"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle, XCircle, MinusCircle, Clock, Lock } from "lucide-react";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface VoteOption {
  id: string;
  label: string;
  sortOrder: number;
}

interface VoteSummary {
  id: string;
  title: string;
  description: string | null;
  voteType: string;
  status: string;
  isSecret: boolean;
  majorityType?: string;
  quorumRequired: number;
  deadline: string;
  options: VoteOption[];
  ballotCount: number;
  myBallot: { optionId: string; receiptHash: string | null } | null;
}

interface VoteDetail {
  meetingQuorum: {
    isQuorate: boolean;
    presentWeight: number;
    totalWeight: number;
    presentPercentage: number;
  } | null;
  majorityType: string;
  myWeight: number;
}

interface Props {
  vote: VoteSummary;
  onVoted: () => void;
  canClose?: boolean;
}

function useCountdown(deadline: string) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Closed");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setRemaining(`${days}d ${hours}h ${minutes}m`);
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  return remaining;
}

const OPTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Yes: CheckCircle,
  No: XCircle,
  Abstain: MinusCircle,
  Igen: CheckCircle,
  Nem: XCircle,
  Tartózkodom: MinusCircle,
};

interface OptionVisuals {
  semantic: "good" | "danger" | "muted" | "blue";
}

const OPTION_VISUALS: Record<string, OptionVisuals> = {
  Yes: { semantic: "good" },
  No: { semantic: "danger" },
  Abstain: { semantic: "muted" },
  Igen: { semantic: "good" },
  Nem: { semantic: "danger" },
  Tartózkodom: { semantic: "muted" },
};

const DEFAULT_VISUALS: OptionVisuals = { semantic: "blue" };

const SEMANTIC_VAR: Record<OptionVisuals["semantic"], string> = {
  good: "var(--color-good)",
  danger: "var(--color-danger)",
  muted: "var(--color-ink-soft)",
  blue: "var(--color-blue)",
};

const BAR_COLORS = [
  "var(--color-moss)",
  "var(--color-danger)",
  "var(--color-ochre)",
  "var(--color-blue)",
];

function optionStyle(
  visuals: OptionVisuals,
  state: "idle" | "hover" | "selected" | "disabled",
): React.CSSProperties {
  const accent = SEMANTIC_VAR[visuals.semantic];
  if (state === "selected") {
    return {
      background: `color-mix(in srgb, ${accent} 18%, transparent)`,
      borderColor: accent,
      color: accent,
    };
  }
  return {
    background: "var(--color-card)",
    borderColor: "color-mix(in srgb, var(--color-ink) 14%, transparent)",
    color: "var(--color-ink)",
  };
}

export function ActiveVoteCard({ vote, onVoted, canClose }: Props) {
  const t = useTranslations("voting");
  const confirm = useConfirm();
  const countdown = useCountdown(vote.deadline);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    vote.myBallot?.optionId ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [detail, setDetail] = useState<VoteDetail | null>(null);
  const [receiptHash, setReceiptHash] = useState<string | null>(
    vote.myBallot?.receiptHash ?? null,
  );
  const hasVoted = !!vote.myBallot;

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/voting/votes/${vote.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    }
  }, [vote.id, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function handleSubmit() {
    if (!selectedOption || hasVoted) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/voting/votes/${vote.id}/ballot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: selectedOption }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.receiptHash) setReceiptHash(data.receiptHash);
        toast.success(t("voteSubmitted"));
        onVoted();
        fetchDetail();
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  const majorityType = detail?.majorityType ?? vote.majorityType ?? "SIMPLE_MAJORITY";
  const myWeightPct = detail ? (detail.myWeight * 100).toFixed(2) : "0.00";

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-6">
      {/* Top row: type badge + countdown */}
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-bg-3 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-soft">
          {t(`voteType_${vote.voteType}`)}
        </span>
        <div
          className="inline-flex items-center gap-1.5 font-mono text-sm"
          style={{ color: "var(--color-danger)" }}
        >
          <Clock className="h-4 w-4" />
          {countdown} {t("remaining")}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display text-2xl text-ink leading-tight">
        {vote.title}
      </h3>

      {/* Description */}
      {vote.description && (
        <p className="mt-2 text-ink-soft line-clamp-3">{vote.description}</p>
      )}

      {/* Secret ballot indicator */}
      {vote.isSecret && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" />
          {t("secretBallot")}
        </div>
      )}

      {/* Majority type + meeting quorum */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
          style={{
            background: "color-mix(in srgb, var(--color-blue) 18%, transparent)",
            color: "var(--color-blue)",
          }}
        >
          {t(`majorityType_${majorityType}`)}
        </span>
        {detail?.meetingQuorum && (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
            style={
              detail.meetingQuorum.isQuorate
                ? {
                    background: "color-mix(in srgb, var(--color-good) 18%, transparent)",
                    color: "var(--color-good)",
                  }
                : {
                    background: "color-mix(in srgb, var(--color-danger) 18%, transparent)",
                    color: "var(--color-danger)",
                  }
            }
          >
            {detail.meetingQuorum.isQuorate ? t("quorate") : t("notQuorate")} ·{" "}
            {detail.meetingQuorum.presentPercentage.toFixed(1)}%
          </span>
        )}
        <span className="font-mono text-[11px] text-muted">
          {vote.ballotCount} {t("ballotsCast")}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {t(`majorityTypeHint_${majorityType}`)}
      </p>

      {/* Ownership weight */}
      <p className="mt-2 text-sm text-ink-soft">
        {t("yourWeight")}:{" "}
        <span className="font-mono text-ink">{myWeightPct}%</span>
      </p>

      {/* Vote options */}
      <div className="mt-4 flex flex-wrap gap-3">
        {vote.options.map((option) => {
          const Icon = OPTION_ICONS[option.label] ?? CheckCircle;
          const visuals = OPTION_VISUALS[option.label] ?? DEFAULT_VISUALS;
          const isSelected = selectedOption === option.id;
          const isMyVote = vote.myBallot?.optionId === option.id;
          const state =
            isSelected || isMyVote
              ? "selected"
              : hasVoted
                ? "disabled"
                : "idle";

          return (
            <button
              key={option.id}
              onClick={() => !hasVoted && setSelectedOption(option.id)}
              disabled={hasVoted}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all disabled:cursor-not-allowed"
              style={{
                ...optionStyle(visuals, state),
                opacity: hasVoted && !isMyVote ? 0.5 : 1,
              }}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {!hasVoted ? (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption || submitting}
          className="mt-4 rounded-lg bg-ink px-6 py-2.5 font-mono text-[11px] uppercase tracking-wider text-bg transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t("submitting") : t("submitVote")}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: "var(--color-good)" }}
          >
            <CheckCircle className="h-4 w-4" />
            {t("voteSubmitted")}
          </div>

          {/* Live results after voting */}
          {detail &&
            (detail as VoteDetail & { ballots?: { optionId: string; weight: number }[] }).ballots && (
              <div className="rounded-lg bg-bg-3 p-3">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                  {t("currentResults")}
                </p>
                {vote.options.map((option) => {
                  const ballots =
                    ((detail as VoteDetail & {
                      ballots?: { optionId: string; weight: number }[];
                    }).ballots ?? []);
                  const optWeight = ballots
                    .filter((b) => b.optionId === option.id)
                    .reduce((sum, b) => sum + b.weight, 0);
                  const totalWeight = ballots.reduce(
                    (sum, b) => sum + b.weight,
                    0,
                  );
                  const pct = totalWeight > 0 ? (optWeight / totalWeight) * 100 : 0;
                  const barColor = BAR_COLORS[option.sortOrder % BAR_COLORS.length];
                  return (
                    <div key={option.id} className="mb-1.5 last:mb-0">
                      <div className="flex items-center justify-between text-xs text-ink-soft">
                        <span>{option.label}</span>
                        <span className="font-mono text-ink">{pct.toFixed(1)}%</span>
                      </div>
                      <div
                        className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                        }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Receipt hash for secret ballots */}
      {receiptHash && (
        <div className="mt-3 rounded-lg bg-bg-3 p-3 text-xs">
          <p className="font-mono uppercase tracking-wider text-muted">
            {t("receiptHash")}
          </p>
          <p className="mt-1 break-all font-mono text-ink-soft">{receiptHash}</p>
        </div>
      )}

      {/* Close vote button — board+ only */}
      {canClose && (
        <div className="mt-4 border-t border-ink/8 pt-4">
          <button
            onClick={async () => {
              const ok = await confirm({
                title: t("confirmCloseVote"),
                danger: true,
              });
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
                  onVoted();
                } else {
                  const data = await res.json();
                  toast.error(data.error || t("somethingWentWrong"));
                }
              } catch {
                toast.error(t("somethingWentWrong"));
              } finally {
                setClosing(false);
              }
            }}
            disabled={closing}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50"
            style={{
              border: "1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            <XCircle className="h-3.5 w-3.5" />
            {closing ? t("closingVote") : t("closeVote")}
          </button>
        </div>
      )}
    </div>
  );
}
