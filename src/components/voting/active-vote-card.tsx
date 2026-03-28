"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, XCircle, MinusCircle, Clock, Lock } from "lucide-react";

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
  quorumRequired: number;
  deadline: string;
  options: VoteOption[];
  ballotCount: number;
  myBallot: { optionId: string; receiptHash: string | null } | null;
}

interface VoteDetail {
  quorum: {
    current: number;
    required: number;
    totalBallotWeight: number;
    totalOwnershipShares: number;
  };
  myWeight: number;
}

interface Props {
  vote: VoteSummary;
  onVoted: () => void;
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
  "Tartózkodom": MinusCircle,
};

const OPTION_COLORS: Record<string, { hover: string; selected: string; border: string }> = {
  Yes: { hover: "hover:bg-green-50 hover:border-green-500", selected: "bg-green-100 border-green-600", border: "border-green-500" },
  No: { hover: "hover:bg-red-50 hover:border-red-500", selected: "bg-red-100 border-red-600", border: "border-red-500" },
  Abstain: { hover: "hover:bg-slate-50 hover:border-slate-400", selected: "bg-slate-100 border-slate-500", border: "border-slate-400" },
  Igen: { hover: "hover:bg-green-50 hover:border-green-500", selected: "bg-green-100 border-green-600", border: "border-green-500" },
  Nem: { hover: "hover:bg-red-50 hover:border-red-500", selected: "bg-red-100 border-red-600", border: "border-red-500" },
  "Tartózkodom": { hover: "hover:bg-slate-50 hover:border-slate-400", selected: "bg-slate-100 border-slate-500", border: "border-slate-400" },
};

const DEFAULT_COLORS = { hover: "hover:bg-blue-50 hover:border-blue-500", selected: "bg-blue-100 border-blue-600", border: "border-blue-500" };

export function ActiveVoteCard({ vote, onVoted }: Props) {
  const t = useTranslations("voting");
  const countdown = useCountdown(vote.deadline);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    vote.myBallot?.optionId ?? null
  );
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<VoteDetail | null>(null);
  const [receiptHash, setReceiptHash] = useState<string | null>(
    vote.myBallot?.receiptHash ?? null
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
      // silent
    }
  }, [vote.id]);

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
        if (data.receiptHash) {
          setReceiptHash(data.receiptHash);
        }
        onVoted();
        fetchDetail();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  const quorumPct = detail ? Math.round(detail.quorum.current * 100) : 0;
  const quorumReqPct = Math.round(vote.quorumRequired * 100);
  const myWeightPct = detail ? (detail.myWeight * 100).toFixed(2) : "0.00";

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      {/* Top row: type badge + countdown */}
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
          {t(`voteType_${vote.voteType}`)}
        </span>
        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-red-600">
          <Clock className="h-4 w-4" />
          {countdown} {t("remaining")}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-slate-900">{vote.title}</h3>

      {/* Description */}
      {vote.description && (
        <p className="mt-2 text-slate-600 line-clamp-3">{vote.description}</p>
      )}

      {/* Secret ballot indicator */}
      {vote.isSecret && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          {t("secretBallot")}
        </div>
      )}

      {/* Quorum progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {t("quorum")}: {quorumPct}% ({t("required")}: {quorumReqPct}%)
          </span>
          <span className="text-xs text-slate-500">
            {vote.ballotCount} {t("ballotsCast")}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              quorumPct >= quorumReqPct ? "bg-green-500" : "bg-[#002045]"
            }`}
            style={{ width: `${Math.min(quorumPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Ownership weight */}
      <p className="mt-2 text-sm text-slate-500">
        {t("yourWeight")}: {myWeightPct}%
      </p>

      {/* Vote options */}
      <div className="mt-4 flex flex-wrap gap-3">
        {vote.options.map((option) => {
          const Icon = OPTION_ICONS[option.label] ?? CheckCircle;
          const colors = OPTION_COLORS[option.label] ?? DEFAULT_COLORS;
          const isSelected = selectedOption === option.id;
          const isMyVote = vote.myBallot?.optionId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => !hasVoted && setSelectedOption(option.id)}
              disabled={hasVoted}
              className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                isSelected || isMyVote
                  ? colors.selected
                  : `border-slate-200 ${hasVoted ? "opacity-50 cursor-not-allowed" : colors.hover}`
              }`}
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
          className="mt-4 rounded-lg bg-[#002045] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#002045]/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t("submitting") : t("submitVote")}
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {t("voteSubmitted")}
        </div>
      )}

      {/* Receipt hash for secret ballots */}
      {receiptHash && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
          <p className="font-semibold text-slate-700">{t("receiptHash")}:</p>
          <p className="mt-1 break-all font-mono text-slate-500">{receiptHash}</p>
        </div>
      )}
    </div>
  );
}
