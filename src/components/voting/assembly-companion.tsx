"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { MeetingDetailData } from "@/lib/dal";
import { useAssemblyStream } from "@/hooks/use-assembly-stream";

interface AgendaItem {
  title: string;
  description?: string;
  voteId?: string;
}

function parseAgenda(raw: unknown): AgendaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it, i) => {
    if (typeof it === "string") return { title: it };
    const o = (it ?? {}) as Record<string, unknown>;
    return {
      title: typeof o.title === "string" ? o.title : `Pont ${i + 1}`,
      description: typeof o.description === "string" ? o.description : undefined,
      voteId: typeof o.voteId === "string" ? o.voteId : undefined,
    };
  });
}

interface VoteDetail {
  id: string;
  status: string;
  myWeight: number;
  myBallot: { optionId: string } | null;
  options: { id: string; label: string }[];
}

export function AssemblyCompanion({
  meeting,
  locale,
}: {
  meeting: MeetingDetailData;
  locale: string;
}) {
  const t = useTranslations("assembly");
  const router = useRouter();
  const [detail, setDetail] = useState<VoteDetail | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [qText, setQText] = useState("");
  const [sent, setSent] = useState<"q" | "h" | null>(null);
  const [sending, setSending] = useState(false);

  async function submitQuestion(type: "QUESTION" | "HAND", text?: string) {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/voting/meetings/${meeting.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("actionFailed"));
        return;
      }
      setSent(type === "HAND" ? "h" : "q");
      setComposing(false);
      setQText("");
    } finally {
      setSending(false);
    }
  }

  useAssemblyStream(meeting.id, () => router.refresh());

  const agenda = parseAgenda(meeting.agenda);
  const idx = Math.min(meeting.currentAgendaIndex, Math.max(0, agenda.length - 1));
  const point = agenda[idx];
  const pointVote = point?.voteId
    ? meeting.votes.find((v) => v.id === point.voteId)
    : undefined;
  const openNow =
    !!pointVote && meeting.currentVoteId === pointVote.id && pointVote.status === "OPEN";

  const voteId = pointVote?.id;
  const voteStatus = pointVote?.status;
  useEffect(() => {
    let alive = true;
    if (!voteId) {
      setDetail(null);
      return;
    }
    (async () => {
      const res = await fetch(`/api/voting/votes/${voteId}`, { cache: "no-store" });
      if (res.ok && alive) {
        setDetail(await res.json());
        setPicked(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [voteId, voteStatus]);

  async function cast() {
    if (!picked || !voteId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/voting/votes/${voteId}/ballot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: picked }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || t("actionFailed"));
        return;
      }
      const fresh = await fetch(`/api/voting/votes/${voteId}`, { cache: "no-store" });
      if (fresh.ok) setDetail(await fresh.json());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (meeting.liveStatus !== "LIVE") {
    const closed = meeting.liveStatus === "CLOSED";
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-xl text-ink">
          {closed ? t("companionClosed") : t("companionNotLive")}
        </h1>
        <a
          href={`/${locale}/voting/meetings/${meeting.id}`}
          className="mt-5 inline-block rounded-xl px-5 py-3 text-sm font-semibold"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          {t("toMeeting")}
        </a>
      </div>
    );
  }

  const sharePct = detail ? (detail.myWeight * 100).toFixed(2) : null;

  return (
    <div className="mx-auto max-w-md" style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* live strip */}
      <div
        className="flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold"
        style={{ background: "var(--color-ochre)", color: "var(--color-ink)" }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-ink)" }} />
        {t("companionLive")}
        <span className="ml-auto font-mono text-[10px]">{meeting.title}</span>
      </div>

      <div className="px-5 py-5">
        {/* current point */}
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)" }}>
          {t("companionFollowing", { n: idx + 1, total: agenda.length })}
        </div>
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
          <h1 className="font-display" style={{ fontSize: 21, lineHeight: 1.15, letterSpacing: "-0.025em" }}>
            {point?.title ?? "—"}
          </h1>
          {point?.description && (
            <p className="mt-2.5 text-[13.5px]" style={{ color: "var(--color-ink-soft)", lineHeight: 1.5 }}>
              {point.description}
            </p>
          )}
          {sharePct && (
            <div className="mt-3.5 pt-3.5 font-mono text-[11px]" style={{ borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)", color: "var(--color-muted)" }}>
              {t("companionYourShare")} <b style={{ color: "var(--color-ink)" }}>{sharePct}%</b>
            </div>
          )}
        </div>

        {/* vote card */}
        {pointVote && openNow && detail && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
            <div className="flex items-center gap-2 mb-3.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: "var(--color-ochre)" }}>
                ● {t("voteOpenPill")}
              </span>
            </div>
            {detail.myBallot ? (
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-[13.5px] font-semibold"
                style={{ background: "color-mix(in srgb, var(--color-moss-2) 22%, transparent)", color: "#dce4d0" }}>
                ✓ {t("companionVoted", {
                  label: detail.options.find((o) => o.id === detail.myBallot?.optionId)?.label ?? "",
                })}
              </div>
            ) : (
              <>
                {detail.options.map((o) => {
                  const sel = picked === o.id;
                  return (
                    <button key={o.id} onClick={() => setPicked(o.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 mb-2 text-left text-[15px] font-semibold"
                      style={{
                        border: `1.5px solid ${sel ? "var(--color-ochre)" : "color-mix(in srgb, var(--color-bg) 20%, transparent)"}`,
                        background: sel ? "color-mix(in srgb, var(--color-ochre) 16%, transparent)" : "transparent",
                      }}>
                      <span className="grid place-items-center" style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? "var(--color-ochre)" : "color-mix(in srgb, var(--color-bg) 35%, transparent)"}`, background: sel ? "var(--color-ochre)" : "transparent" }} />
                      {o.label}
                    </button>
                  );
                })}
                <button onClick={cast} disabled={!picked || busy}
                  className="mt-1.5 w-full rounded-xl py-3.5 font-bold disabled:opacity-50"
                  style={{ background: "var(--color-ochre)", color: "var(--color-ink)" }}>
                  {t("castVote")}
                </button>
              </>
            )}
            <p className="mt-3 text-center text-[12px]" style={{ color: "color-mix(in srgb, var(--color-bg) 55%, transparent)" }}>
              {t("companionTallyHidden")}
            </p>
          </div>
        )}

        {/* closed result */}
        {pointVote && pointVote.status === "CLOSED" && (
          <div className="rounded-2xl p-4 mb-4 font-display font-bold"
            style={
              (pointVote.award?.outcome === "AWARDED" || pointVote.passed)
                ? { background: "color-mix(in srgb, var(--color-moss) 14%, var(--color-card))", color: "var(--color-moss)" }
                : { background: "color-mix(in srgb, var(--color-danger) 16%, var(--color-card))", color: "var(--color-danger)" }
            }>
            {pointVote.award?.outcome === "AWARDED"
              ? `✓ ${t("resultPassed")} — ${pointVote.award.winnerLabel}`
              : pointVote.passed
                ? `✓ ${t("resultPassed")}`
                : t("resultDefeated")}
          </div>
        )}

        {/* interaction (Q&A) */}
        {sent ? (
          <div className="rounded-2xl p-3.5 text-center text-[13px] font-semibold"
            style={{ background: "color-mix(in srgb, var(--color-moss) 14%, var(--color-card))", color: "var(--color-moss)" }}>
            ✓ {sent === "h" ? t("handSent") : t("questionSent")}
          </div>
        ) : composing ? (
          <div className="rounded-2xl p-3" style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
            <textarea value={qText} onChange={(e) => setQText(e.target.value)} rows={3}
              placeholder={t("askPlaceholder")} autoFocus
              className="w-full rounded-lg p-2.5 text-[14px] outline-none"
              style={{ border: "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)", background: "var(--color-bg-3)", resize: "none" }} />
            <div className="mt-2 flex gap-2">
              <button onClick={() => { setComposing(false); setQText(""); }}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
                style={{ border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)", color: "var(--color-ink-soft)" }}>
                {t("cancel")}
              </button>
              <button disabled={!qText.trim() || sending} onClick={() => submitQuestion("QUESTION", qText.trim())}
                className="flex-1 rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
                {t("send")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setComposing(true)}
              className="rounded-2xl p-3.5 text-center"
              style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
              <strong className="font-display text-[13px] block">{t("companionAsk")}</strong>
            </button>
            <button disabled={sending} onClick={() => submitQuestion("HAND")}
              className="rounded-2xl p-3.5 text-center disabled:opacity-50"
              style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
              <strong className="font-display text-[13px] block">{t("companionRaiseHand")}</strong>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
