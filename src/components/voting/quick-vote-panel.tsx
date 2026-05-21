"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Check, ChevronDown, ChevronUp } from "lucide-react";

interface VoteOption {
  id: string;
  label: string;
}

interface UnitVoteStatus {
  unitId: string;
  unitNumber: string;
  ownerName: string | null;
  hasVoted: boolean;
  votedOptionLabel: string | null;
  castByName: string | null;
}

interface QuickVoteProps {
  voteId: string;
  voteTitle: string;
  options: VoteOption[];
  buildingId: string;
}

export function QuickVotePanel({ voteId, voteTitle, options, buildingId }: QuickVoteProps) {
  const t = useTranslations("voting");
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [units, setUnits] = useState<UnitVoteStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [castingFor, setCastingFor] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [unitsRes, ballotsRes] = await Promise.all([
        fetch(`/api/units?buildingId=${buildingId}`),
        fetch(`/api/voting/votes/${voteId}`),
      ]);

      if (!unitsRes.ok || !ballotsRes.ok) return;

      const unitsData = await unitsRes.json();
      const voteData = await ballotsRes.json();

      const ballotMap = new Map<string, { optionId: string; castById: string | null }>();
      if (voteData.ballots) {
        for (const b of voteData.ballots) {
          ballotMap.set(b.unitId, { optionId: b.optionId, castById: b.castById });
        }
      }

      const optionMap = new Map(options.map((o) => [o.id, o.label]));

      const unitList: UnitVoteStatus[] = (unitsData.units ?? []).map(
        (u: { id: string; number: string; primaryContact?: string | null }) => {
          const ballot = ballotMap.get(u.id);
          return {
            unitId: u.id,
            unitNumber: u.number,
            ownerName: u.primaryContact ?? null,
            hasVoted: !!ballot,
            votedOptionLabel: ballot ? (optionMap.get(ballot.optionId) ?? "—") : null,
            castByName: ballot?.castById ? t("castByOrganizer") : null,
          };
        }
      );

      unitList.sort((a, b) => {
        if (a.hasVoted !== b.hasVoted) return a.hasVoted ? 1 : -1;
        return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
      });

      setUnits(unitList);
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [voteId, buildingId, options, t]);

  useEffect(() => {
    if (expanded && units.length === 0) {
      fetchStatus();
    }
  }, [expanded, units.length, fetchStatus]);

  async function castOnBehalf(unitId: string, optionId: string) {
    setCastingFor(unitId);
    try {
      const res = await fetch(`/api/voting/votes/${voteId}/ballot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId, onBehalfOfUnitId: unitId }),
      });

      if (res.ok) {
        toast.success(t("voteCastOnBehalf"));
        await fetchStatus();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("somethingWentWrong"));
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setCastingFor(null);
    }
  }

  const votedCount = units.filter((u) => u.hasVoted).length;
  const totalCount = units.length;

  return (
    <div className="rounded-xl border border-ink/8 bg-card overflow-hidden">
      {/* Header — click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-muted" />
          <div>
            <h4 className="font-mono text-xs uppercase tracking-wider text-ink">
              {t("quickVote")}
            </h4>
            <p className="mt-0.5 text-xs text-muted">{voteTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="rounded-full bg-bg-3 px-2.5 py-0.5 font-mono text-[11px] text-ink">
              {votedCount}/{totalCount}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-ink/8 px-5 py-4">
          {loading ? (
            <p className="py-4 text-center text-sm text-muted">{t("loading")}</p>
          ) : units.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">{t("noUnitsFound")}</p>
          ) : (
            <div className="space-y-2">
              {/* Legend */}
              <div className="mb-3 flex items-center gap-4 font-mono text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--color-good)" }}
                  />
                  {t("voted")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--color-tile-a)" }}
                  />
                  {t("notVotedYet")}
                </span>
              </div>

              {units.map((unit) => (
                <div
                  key={unit.unitId}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{
                    background: unit.hasVoted
                      ? "color-mix(in srgb, var(--color-good) 8%, transparent)"
                      : "var(--color-bg-3)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-[11px]"
                      style={
                        unit.hasVoted
                          ? {
                              background:
                                "color-mix(in srgb, var(--color-good) 18%, transparent)",
                              color: "var(--color-good)",
                            }
                          : {
                              background:
                                "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                              color: "var(--color-ink-soft)",
                            }
                      }
                    >
                      {unit.unitNumber}
                    </span>
                    <div>
                      <span className="text-sm text-ink">
                        {unit.ownerName ?? t("noOwner")}
                      </span>
                      {unit.hasVoted && (
                        <div
                          className="mt-0.5 flex items-center gap-1.5 text-xs"
                          style={{ color: "var(--color-good)" }}
                        >
                          <Check className="h-3 w-3" />
                          {unit.votedOptionLabel}
                          {unit.castByName && (
                            <span className="text-muted">
                              ({unit.castByName})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!unit.hasVoted && (
                    <div className="flex items-center gap-1">
                      {options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => castOnBehalf(unit.unitId, opt.id)}
                          disabled={castingFor === unit.unitId}
                          className="rounded-md border border-ink/15 bg-card px-2.5 py-1 text-xs text-ink hover:bg-bg-3 hover:border-ink/30 disabled:opacity-50 transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
