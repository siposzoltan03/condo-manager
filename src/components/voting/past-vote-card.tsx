"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface VoteSummary {
  id: string;
  title: string;
  description: string | null;
  voteType: string;
  status: string;
  deadline: string;
  createdAt: string;
}

interface VoteResult {
  options: Array<{
    id: string;
    label: string;
    votes: number;
    weight: number;
    percentage: number;
  }>;
  totalWeight: number;
  majorityType: string;
  passed: boolean;
}

interface Props {
  vote: VoteSummary;
}

const BAR_COLORS = [
  "var(--color-moss)",
  "var(--color-danger)",
  "var(--color-tile-a)",
  "var(--color-blue)",
];

export function PastVoteCard({ vote }: Props) {
  const t = useTranslations("voting");
  const [results, setResults] = useState<VoteResult | null>(null);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch(`/api/voting/votes/${vote.id}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } catch {
        toast.error(t("somethingWentWrong"));
      }
    }
    fetchResults();
  }, [vote.id, t]);

  const passed = results?.passed ?? false;
  const closedDate = new Date(vote.deadline).toLocaleDateString();

  const resultStyle = passed
    ? {
        background: "color-mix(in srgb, var(--color-good) 18%, transparent)",
        color: "var(--color-good)",
      }
    : {
        background: "color-mix(in srgb, var(--color-danger) 18%, transparent)",
        color: "var(--color-danger)",
      };

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-5">
      {/* Result badge */}
      <div className="mb-2">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider"
          style={resultStyle}
        >
          {passed ? t("passed") : t("defeated")}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display text-base text-ink leading-tight">
        {vote.title}
      </h3>
      <p className="mt-1 font-mono text-[11px] text-muted">
        {closedDate}
        {results?.majorityType && (
          <span className="ml-2">
            {t(`majorityType_${results.majorityType}`)}
          </span>
        )}
      </p>

      {/* Bar chart distribution */}
      {results && results.options.length > 0 && (
        <div className="mt-3">
          {/* Stacked bar */}
          <div
            className="flex h-3 w-full overflow-hidden rounded-full"
            style={{
              background:
                "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            {results.options.map((opt, i) => (
              <div
                key={opt.id}
                className="transition-all"
                style={{
                  width: `${opt.percentage}%`,
                  background: BAR_COLORS[i % BAR_COLORS.length],
                }}
                title={`${opt.label}: ${opt.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
          {/* Text breakdown */}
          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-soft">
            {results.options.map((opt) => (
              <span key={opt.id}>
                {opt.label}:{" "}
                <span className="font-mono text-ink">
                  {opt.percentage.toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
