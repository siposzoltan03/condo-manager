"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserCheck, UserX, Users, Shield } from "lucide-react";

interface UnitAttendance {
  unitId: string;
  unitNumber: string;
  ownershipShare: number;
  ownerName: string | null;
  checkedIn: boolean;
}

interface MeetingQuorum {
  isQuorate: boolean;
  presentWeight: number;
  totalWeight: number;
  presentPercentage: number;
  presentUnitCount: number;
  totalUnitCount: number;
}

interface AttendancePanelProps {
  meetingId: string;
  isBoardMember: boolean;
  isRepeated: boolean;
}

export function AttendancePanel({ meetingId, isBoardMember, isRepeated }: AttendancePanelProps) {
  const t = useTranslations("voting");
  const [units, setUnits] = useState<UnitAttendance[]>([]);
  const [quorum, setQuorum] = useState<MeetingQuorum | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingUnit, setTogglingUnit] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch(`/api/voting/meetings/${meetingId}/attendance`);
      if (!res.ok) return;
      const data = await res.json();
      setUnits(data.units);
      setQuorum(data.quorum);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const toggleAttendance = async (unitId: string, currentlyCheckedIn: boolean) => {
    setTogglingUnit(unitId);
    try {
      const method = currentlyCheckedIn ? "DELETE" : "POST";
      const res = await fetch(`/api/voting/meetings/${meetingId}/attendance`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? t("somethingWentWrong"));
        return;
      }

      await fetchAttendance();
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setTogglingUnit(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-ink/8 bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users className="h-4 w-4" />
          {t("attendance")}…
        </div>
      </div>
    );
  }

  const presentCount = units.filter((u) => u.checkedIn).length;

  const quoratePillStyle = quorum?.isQuorate
    ? {
        background: "color-mix(in srgb, var(--color-good) 18%, transparent)",
        color: "var(--color-good)",
      }
    : {
        background: "color-mix(in srgb, var(--color-danger) 18%, transparent)",
        color: "var(--color-danger)",
      };

  return (
    <div className="rounded-xl border border-ink/8 bg-card overflow-hidden">
      {/* Header with quorum status */}
      <div className="border-b border-ink/8 p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-ink">
            <Users className="h-4 w-4 text-muted" />
            {t("attendance")}
          </h3>
          {quorum && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
              style={quoratePillStyle}
            >
              <Shield className="h-3 w-3" />
              {quorum.isQuorate ? t("quorate") : t("notQuorate")}
            </span>
          )}
        </div>

        {isRepeated && (
          <p className="mt-1.5 text-xs text-muted">{t("alwaysQuorate")}</p>
        )}

        {/* Quorum progress bar */}
        {quorum && (
          <div className="mt-3">
            <div className="flex justify-between font-mono text-[11px] text-muted mb-1.5">
              <span>
                {presentCount}/{units.length} {t("checkedIn").toLowerCase()}
              </span>
              <span className="text-ink">
                {quorum.presentPercentage.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--color-bg-3)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(quorum.presentPercentage, 100)}%`,
                  background: quorum.isQuorate
                    ? "var(--color-good)"
                    : "var(--color-ochre)",
                }}
              />
            </div>
            {!isRepeated && (
              <p className="mt-1.5 text-xs text-muted">
                {t("neededToPass")}: &gt;50% {t("ofAllShares")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Unit list */}
      <div className="divide-y divide-ink/8 max-h-80 overflow-y-auto">
        {units.map((unit) => (
          <div
            key={unit.unitId}
            className="flex items-center justify-between px-5 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={
                  unit.checkedIn
                    ? {
                        background:
                          "color-mix(in srgb, var(--color-good) 18%, transparent)",
                        color: "var(--color-good)",
                      }
                    : {
                        background: "var(--color-bg-3)",
                        color: "var(--color-muted)",
                      }
                }
              >
                {unit.checkedIn ? (
                  <UserCheck className="h-3.5 w-3.5" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">
                  <span className="font-mono">#{unit.unitNumber}</span>
                  {unit.ownerName && (
                    <span className="ml-1.5 text-muted">{unit.ownerName}</span>
                  )}
                </p>
                <p className="font-mono text-[11px] text-muted">
                  {(unit.ownershipShare * 100).toFixed(2)}%
                </p>
              </div>
            </div>

            {isBoardMember && (
              <button
                onClick={() => toggleAttendance(unit.unitId, unit.checkedIn)}
                disabled={togglingUnit === unit.unitId}
                className="shrink-0 rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50"
                style={
                  unit.checkedIn
                    ? {
                        background:
                          "color-mix(in srgb, var(--color-danger) 14%, transparent)",
                        color: "var(--color-danger)",
                      }
                    : {
                        background:
                          "color-mix(in srgb, var(--color-good) 18%, transparent)",
                        color: "var(--color-good)",
                      }
                }
              >
                {togglingUnit === unit.unitId
                  ? "…"
                  : unit.checkedIn
                    ? t("checkOut")
                    : t("checkIn")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
