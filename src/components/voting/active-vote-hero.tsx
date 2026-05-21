"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ActiveVoteData } from "@/lib/voting-dal";

interface Props {
  vote: ActiveVoteData;
}

export function ActiveVoteHero({ vote }: Props) {
  const t = useTranslations("voting");
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(vote.userPickedOptionId);
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const quorumPctActual =
    vote.totalShares > 0
      ? Math.round((vote.castShares / vote.totalShares) * 1000) / 10
      : 0;

  // Countdown bits.
  const remainingMs = new Date(vote.deadline).getTime() - Date.now();
  const days = Math.max(0, Math.floor(remainingMs / 86_400_000));
  const hours = Math.max(0, Math.floor((remainingMs % 86_400_000) / 3_600_000));
  const minutes = Math.max(0, Math.floor((remainingMs % 3_600_000) / 60_000));

  const majorityLabel = (() => {
    switch (vote.majorityType) {
      case "TWO_THIRDS":
        return t("majority.qualified");
      case "FOUR_FIFTHS":
        return t("majority.fourFifths");
      case "UNANIMOUS":
        return t("majority.unanimous");
      case "PLURALITY":
        return t("majority.plurality");
      default:
        return t("majority.simple");
    }
  })();

  const isCritical =
    vote.majorityType === "TWO_THIRDS" ||
    vote.majorityType === "FOUR_FIFTHS" ||
    vote.majorityType === "UNANIMOUS";

  const created = new Date(vote.createdAt).toLocaleDateString("hu-HU", {
    month: "short",
    day: "numeric",
  });

  // Build option-label → tone mapping. First option = yes/positive (moss);
  // second = no (danger); third+ = abstain/neutral.
  function toneFor(idx: number): "yes" | "no" | "abs" {
    if (idx === 0) return "yes";
    if (idx === 1) return "no";
    return "abs";
  }

  async function handleSubmit() {
    if (!picked || submitting || vote.hasUserCast || vote.userOwnershipShare === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/voting/votes/${vote.id}/ballot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId: picked }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          setError(body?.error ?? t("ballotErrors.submitFailed"));
          return;
        }
        router.refresh();
      } catch {
        setError(t("ballotErrors.submitFailed"));
      }
    });
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        borderRadius: "18px",
        padding: "32px",
        marginBottom: "20px",
      }}
    >
      {/* Moss radial accent */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          background:
            "radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--color-moss-2) 35%, transparent), transparent 55%)",
        }}
      />

      <div className="relative">
        {/* Top: meta + countdown */}
        <div className="flex items-start justify-between gap-6 flex-wrap" style={{ marginBottom: "20px" }}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: "4px",
                background: isCritical
                  ? "var(--color-ochre)"
                  : "color-mix(in srgb, var(--color-bg) 12%, transparent)",
                color: isCritical ? "var(--color-ink)" : "var(--color-bg)",
                fontWeight: 600,
              }}
            >
              {majorityLabel}
            </span>
            <span
              className="font-mono inline-flex items-center gap-1.5"
              style={{
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: "var(--color-ochre)",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              <PulseDot />
              {t("hero.live")}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
              }}
            >
              {vote.reference} · {t("hero.openedAt", { date: created })}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {t("hero.timeLeft")}
            </div>
            <div
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "28px",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                marginTop: "4px",
                color: "var(--color-ochre)",
              }}
            >
              {days > 0 && (
                <span
                  style={{
                    color: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
                    fontSize: "14px",
                    marginRight: "4px",
                    fontWeight: 400,
                  }}
                >
                  {days}n
                </span>
              )}
              {String(hours).padStart(2, "0")}ó {String(minutes).padStart(2, "0")}p
            </div>
          </div>
        </div>

        {/* Title + description */}
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "12px",
            maxWidth: "24ch",
          }}
        >
          {vote.title}
        </h2>
        {vote.description && (
          <p
            style={{
              color: "color-mix(in srgb, var(--color-bg) 78%, transparent)",
              maxWidth: "60ch",
              marginBottom: "28px",
            }}
          >
            {vote.description}
          </p>
        )}

        {/* Quorum stats */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          style={{
            padding: "20px 0",
            borderTop: "1px solid color-mix(in srgb, var(--color-bg) 15%, transparent)",
            borderBottom: "1px solid color-mix(in srgb, var(--color-bg) 15%, transparent)",
            marginBottom: "28px",
          }}
        >
          <QuorumStat
            label={t("hero.quorum")}
            value={`${quorumPctActual.toFixed(1)}%`}
            requiredLabel={t("hero.quorumRequired", { pct: vote.quorumThresholdPct.toString() })}
            barPct={Math.min(100, quorumPctActual)}
            barColor="var(--color-moss-2)"
            markPct={vote.quorumThresholdPct}
            sub={t("hero.unitsVoted", {
              voted: vote.unitsVoted.toString(),
              total: vote.totalUnits.toString(),
            })}
          />
          <QuorumStat
            label={t("hero.support")}
            value={`${vote.currentSupportPct.toFixed(1)}%`}
            requiredLabel={t("hero.supportRequired", { pct: vote.supportThresholdPct.toFixed(2) })}
            barPct={Math.min(100, vote.currentSupportPct)}
            barColor="var(--color-ochre)"
            markPct={vote.supportThresholdPct}
            sub={
              vote.currentSupportPct < vote.supportThresholdPct
                ? t("hero.supportGap", {
                    gap: (vote.supportThresholdPct - vote.currentSupportPct).toFixed(1),
                  })
                : t("hero.supportPassing")
            }
          />
          <QuorumStat
            label={t("hero.yourWeight")}
            value={`${(vote.userOwnershipShare * 100).toFixed(2)}%`}
            requiredLabel={t("hero.ownershipShare")}
            barPct={Math.min(100, vote.userOwnershipShare * 100 * 5)}
            barColor="color-mix(in srgb, var(--color-bg) 50%, transparent)"
            sub={
              vote.userOwnershipShare > 0
                ? t("hero.yourUnit")
                : t("hero.notOwner")
            }
          />
        </div>

        {/* Ballot */}
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: "14px" }}
        >
          <h3
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.015em",
            }}
          >
            {t("hero.ballotTitle")}
          </h3>
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
              letterSpacing: "0.04em",
            }}
          >
            {t("hero.ballotWeight")}{" "}
            <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
              {(vote.userOwnershipShare * 100).toFixed(2)}%
            </b>
            {vote.isSecret && ` — ${t("hero.secret")}`}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-3"
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              background: "color-mix(in srgb, var(--color-danger) 20%, transparent)",
              color: "#fbe5db",
              border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)",
            }}
          >
            {error}
          </div>
        )}

        <div
          className="grid gap-2.5 items-stretch"
          style={{
            gridTemplateColumns:
              vote.options.length === 3
                ? "1fr 1fr 1fr auto"
                : `repeat(${vote.options.length}, 1fr) auto`,
          }}
        >
          {vote.options.map((opt, i) => {
            const tone = toneFor(i);
            const isSelected = picked === opt.id;
            const sel = isSelected
              ? tone === "yes"
                ? { bg: "var(--color-moss-2)", color: "var(--color-ink)", border: "var(--color-moss-2)" }
                : tone === "no"
                  ? { bg: "var(--color-danger)", color: "var(--color-bg)", border: "var(--color-danger)" }
                  : {
                      bg: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
                      color: "var(--color-ink)",
                      border: "var(--color-bg)",
                    }
              : null;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={vote.hasUserCast || vote.userOwnershipShare === 0 || submitting}
                onClick={() => setPicked(opt.id)}
                className="transition-all"
                style={{
                  padding: "14px 18px",
                  borderRadius: "10px",
                  border: `1px solid ${sel?.border ?? "color-mix(in srgb, var(--color-bg) 20%, transparent)"}`,
                  background: sel?.bg ?? "transparent",
                  color: sel?.color ?? "var(--color-bg)",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor:
                    vote.hasUserCast || vote.userOwnershipShare === 0 ? "not-allowed" : "pointer",
                  opacity: vote.userOwnershipShare === 0 ? 0.5 : 1,
                }}
              >
                <OptionIcon tone={tone} />
                {opt.label}
              </button>
            );
          })}

          <button
            type="button"
            disabled={
              !picked ||
              vote.hasUserCast ||
              vote.userOwnershipShare === 0 ||
              submitting
            }
            onClick={handleSubmit}
            className="transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: "var(--color-ochre)",
              color: "var(--color-ink)",
              border: 0,
              borderRadius: "10px",
              padding: "0 22px",
              fontWeight: 700,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor:
                !picked ||
                vote.hasUserCast ||
                vote.userOwnershipShare === 0 ||
                submitting
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {vote.hasUserCast
              ? t("hero.alreadyCast")
              : submitting
                ? t("hero.casting")
                : t("hero.submit")}
            {!vote.hasUserCast && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function QuorumStat({
  label,
  value,
  requiredLabel,
  barPct,
  barColor,
  markPct,
  sub,
}: {
  label: string;
  value: string;
  requiredLabel: string;
  barPct: number;
  barColor: string;
  markPct?: number;
  sub: string;
}) {
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
        <small
          style={{
            fontSize: "14px",
            color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
            marginLeft: "4px",
            fontWeight: 400,
          }}
        >
          {requiredLabel}
        </small>
      </div>
      <div
        className="relative overflow-hidden"
        style={{
          height: "6px",
          background: "color-mix(in srgb, var(--color-bg) 12%, transparent)",
          borderRadius: "999px",
          marginTop: "12px",
        }}
      >
        <span
          className="block"
          style={{
            height: "100%",
            background: barColor,
            borderRadius: "999px",
            width: `${barPct}%`,
          }}
        />
        {markPct !== undefined && (
          <span
            aria-hidden
            className="absolute"
            style={{
              top: "-4px",
              bottom: "-4px",
              width: "2px",
              background: "var(--color-ochre)",
              left: `${markPct}%`,
            }}
          />
        )}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
          marginTop: "6px",
          letterSpacing: "0.04em",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function PulseDot() {
  return (
    <span
      aria-hidden
      style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "var(--color-ochre)",
        display: "inline-block",
        animation: "voting-pulse 2s infinite",
      }}
    >
      <style>{`@keyframes voting-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </span>
  );
}

function OptionIcon({ tone }: { tone: "yes" | "no" | "abs" }) {
  const common = {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    "aria-hidden": true,
  } as const;
  if (tone === "yes")
    return (
      <svg {...common}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  if (tone === "no")
    return (
      <svg {...common}>
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 12h14" />
    </svg>
  );
}
