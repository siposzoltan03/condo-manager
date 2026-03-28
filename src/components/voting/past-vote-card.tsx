"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

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
  passed: boolean;
}

interface Props {
  vote: VoteSummary;
}

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
        // silent
      }
    }
    fetchResults();
  }, [vote.id]);

  const passed = results?.passed ?? false;
  const closedDate = new Date(vote.deadline).toLocaleDateString();

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      {/* Result badge */}
      <div className="mb-2">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            passed
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {passed ? t("passed") : t("defeated")}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-slate-900">{vote.title}</h3>
      <p className="text-xs text-slate-500">{closedDate}</p>

      {/* Bar chart distribution */}
      {results && results.options.length > 0 && (
        <div className="mt-3">
          {/* Stacked bar */}
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            {results.options.map((opt, i) => {
              const colors = ["bg-green-500", "bg-red-500", "bg-slate-300"];
              return (
                <div
                  key={opt.id}
                  className={`${colors[i] ?? "bg-blue-400"} transition-all`}
                  style={{ width: `${opt.percentage}%` }}
                  title={`${opt.label}: ${opt.percentage.toFixed(1)}%`}
                />
              );
            })}
          </div>
          {/* Text breakdown */}
          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-600">
            {results.options.map((opt) => (
              <span key={opt.id}>
                {opt.label}: {opt.percentage.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
