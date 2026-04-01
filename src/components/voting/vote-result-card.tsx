import { useTranslations } from "next-intl";
import type { MeetingVoteResult } from "@/lib/dal";

interface VoteResultCardProps {
  vote: MeetingVoteResult;
}

export function VoteResultCard({ vote }: VoteResultCardProps) {
  const t = useTranslations("voting");

  const statusBadge =
    vote.status === "CLOSED"
      ? vote.passed
        ? { text: t("passed"), cls: "bg-emerald-100 text-emerald-800" }
        : { text: t("defeated"), cls: "bg-red-100 text-red-800" }
      : { text: t("voteOpen"), cls: "bg-blue-100 text-blue-800" };

  const colors = ["bg-emerald-500", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-slate-400"];

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-[#c4c6cf]/20">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-[#131b2e]">{vote.title}</h4>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge.cls}`}>
          {statusBadge.text}
        </span>
      </div>

      {/* Stacked bar */}
      {vote.totalWeight > 0 && (
        <div className="mb-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {vote.options.map((opt, i) => {
              const pct = (opt.weight / vote.totalWeight) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={opt.id}
                  className={`${colors[i % colors.length]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Option breakdown */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#515f74]">
        {vote.options.map((opt) => {
          const pct = vote.totalWeight > 0 ? ((opt.weight / vote.totalWeight) * 100).toFixed(1) : "0.0";
          return (
            <span key={opt.id}>
              {opt.label}: <span className="font-bold text-[#131b2e]">{pct}%</span>
            </span>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-[#74777f]">
        {vote.ballotCount} {t("ballotsCast")} · {t("quorum")}: {(vote.quorumRequired * 100).toFixed(0)}%
        {vote.status === "CLOSED" && " ✓"}
      </div>
    </div>
  );
}
