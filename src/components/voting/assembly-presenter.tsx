"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { MeetingDetailData, MeetingVoteResult } from "@/lib/dal";
import { useAssemblyStream } from "@/hooks/use-assembly-stream";

type Format = "IN_PERSON" | "HYBRID" | "ONLINE";
type VoteMode = "DEVICE" | "HANDS";

interface AgendaItem {
  title: string;
  description?: string;
  kind?: string;
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
      kind: typeof o.kind === "string" ? o.kind : undefined,
      voteId: typeof o.voteId === "string" ? o.voteId : undefined,
    };
  });
}

const fmtHMS = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

export function AssemblyPresenter({
  meeting,
  locale,
}: {
  meeting: MeetingDetailData;
  locale: string;
}) {
  const t = useTranslations("assembly");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<Format>("HYBRID");
  const [voteMode, setVoteMode] = useState<VoteMode>("DEVICE");

  // Refetch authoritative state on every live signal.
  useAssemblyStream(meeting.id, () => router.refresh());

  async function post(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/voting/meetings/${meeting.id}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) toast.error(t("actionFailed"));
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function closeVote(voteId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/voting/votes/${voteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) toast.error(t("actionFailed"));
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markQuestion(qid: string) {
    await fetch(`/api/voting/meetings/${meeting.id}/questions/${qid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ADDRESSED" }),
    });
    router.refresh();
  }

  // ── SETUP ──────────────────────────────────────────────────────────────
  if (meeting.liveStatus !== "LIVE") {
    const closed = meeting.liveStatus === "CLOSED";
    if (closed) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl text-ink">{t("closedHeading")}</h1>
          <p className="mt-3 text-ink-soft">{t("closedBody")}</p>
          <p className="mt-1 text-sm text-muted">{t("closedDraftNote")}</p>
          <a
            href={`/${locale}/voting/meetings/${meeting.id}?tab=minutes`}
            className="mt-6 inline-block rounded-xl bg-ink px-5 py-3 font-semibold text-bg"
          >
            {t("toMinutes")}
          </a>
        </div>
      );
    }
    return <SetupView
      meeting={meeting}
      format={format}
      voteMode={voteMode}
      setFormat={setFormat}
      setVoteMode={setVoteMode}
      busy={busy}
      onStart={() => post({ action: "start", format, voteMode })}
      t={t}
    />;
  }

  // ── LIVE ───────────────────────────────────────────────────────────────
  const agenda = parseAgenda(meeting.agenda);
  const idx = Math.min(meeting.currentAgendaIndex, Math.max(0, agenda.length - 1));
  const point = agenda[idx];
  const voteForPoint = point?.voteId
    ? meeting.votes.find((v) => v.id === point.voteId)
    : undefined;

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      {/* top bar */}
      <div className="flex items-center gap-4 px-7 py-3.5" style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
        <span className="font-display font-semibold">Közös</span>
        <span style={{ width: 1, height: 22, background: "color-mix(in srgb, var(--color-bg) 20%, transparent)" }} />
        <div className="text-sm font-semibold" style={{ opacity: 0.9 }}>{meeting.title}</div>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-wider" style={{ opacity: 0.7 }}>
            {t(`format_${meeting.format ?? "HYBRID"}`)} · {t(`voteMode_${meeting.voteMode ?? "DEVICE"}`)}
          </span>
          <LiveTimer startedAt={meeting.startedAt} />
          <button
            onClick={() => post({ action: "end" })}
            disabled={busy}
            className="rounded-lg px-3.5 py-2 text-sm font-semibold"
            style={{ background: "color-mix(in srgb, var(--color-bg) 14%, transparent)", color: "var(--color-bg)" }}
          >
            {t("adjourn")}
          </button>
        </div>
      </div>

      {/* quorum strip */}
      <div className="flex items-center gap-5 px-7 py-3.5" style={{ background: "var(--color-bg-3)", borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>{t("quorumPresent")}</span>
          <span className="font-display text-lg font-bold">{meeting.quorum.presentPercentage.toFixed(1)}%</span>
        </div>
        <div className="flex-1">
          <div className="flex justify-between font-mono text-[11px] mb-1.5" style={{ color: "var(--color-muted)" }}>
            <span>{t("quorumPresentLong")}</span>
            <span><b style={{ color: "var(--color-ink)" }}>{meeting.quorum.presentUnitCount}</b> / {meeting.quorum.totalUnitCount} · {t("threshold")}</span>
          </div>
          <div className="relative h-2.5 rounded-md overflow-hidden" style={{ background: "var(--color-bg-2)" }}>
            <div className="h-full rounded-md" style={{ width: `${Math.min(100, meeting.quorum.presentPercentage)}%`, background: "var(--color-moss-2)" }} />
            <div style={{ position: "absolute", top: -3, bottom: -3, left: "50%", width: 2, background: "var(--color-ochre)" }} />
          </div>
        </div>
        <span
          className="font-mono text-[11px] font-semibold rounded-lg px-3 py-1.5"
          style={
            meeting.quorum.isQuorate
              ? { background: "color-mix(in srgb, var(--color-moss) 14%, var(--color-card))", color: "var(--color-moss)" }
              : { background: "color-mix(in srgb, var(--color-danger) 16%, var(--color-card))", color: "var(--color-danger)" }
          }
        >
          {meeting.quorum.isQuorate ? `✓ ${t("quorate")}` : t("notQuorate")}
        </span>
      </div>

      {/* main + side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px" }}>
        <div className="px-10 py-9" style={{ minHeight: "60vh" }}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="font-display text-sm font-bold" style={{ color: "var(--color-muted)" }}>
              {t("pointN", { n: idx + 1, total: agenda.length })}
            </span>
          </div>
          <h2 className="font-display" style={{ fontSize: 38, lineHeight: 1.07, letterSpacing: "-0.035em", maxWidth: "18ch" }}>
            {point?.title ?? "—"}
          </h2>
          {point?.description && (
            <div className="mt-5 rounded-2xl p-5" style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)", maxWidth: "60ch" }}>
              <span className="font-mono text-[10.5px] uppercase tracking-wider block mb-2" style={{ color: "var(--color-muted)" }}>{t("motion")}</span>
              <span style={{ color: "var(--color-ink-soft)", lineHeight: 1.55 }}>{point.description}</span>
            </div>
          )}

          {/* vote control */}
          <div className="mt-9">
            <VoteControl
              meeting={meeting}
              vote={voteForPoint}
              idx={idx}
              agendaLen={agenda.length}
              busy={busy}
              onOpen={(voteId) => post({ action: "openVote", voteId })}
              onClose={closeVote}
              onPoint={(i) => post({ action: "point", index: i })}
              t={t}
            />
          </div>

          {/* point nav */}
          <div className="mt-8 flex gap-2">
            <button disabled={busy || idx <= 0} onClick={() => post({ action: "point", index: idx - 1 })}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)" }}>
              ← {t("prevPoint")}
            </button>
            <button disabled={busy || idx >= agenda.length - 1} onClick={() => post({ action: "point", index: idx + 1 })}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)" }}>
              {t("nextPoint")} →
            </button>
          </div>
        </div>

        {/* side panel */}
        <aside style={{ borderLeft: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)", background: "var(--color-bg-3)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
            <span className="font-mono text-[10.5px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
              {t("agendaTitle")} · {idx + 1}/{agenda.length}
            </span>
            <div className="mt-3 flex flex-col gap-1">
              {agenda.map((a, i) => {
                const cur = i === idx;
                const done = i < idx;
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                    style={cur ? { background: "var(--color-ink)", color: "var(--color-bg)" } : undefined}>
                    <span className="grid place-items-center rounded-md font-mono text-[11px] font-semibold"
                      style={{ width: 22, height: 22, background: done ? "var(--color-moss)" : cur ? "color-mix(in srgb, var(--color-bg) 22%, transparent)" : "var(--color-bg-2)", color: done ? "#f5f2e6" : cur ? "var(--color-bg)" : "var(--color-ink-soft)" }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold truncate">{a.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-5 py-4">
            {(() => {
              const pending = meeting.questions.filter((q) => q.status === "PENDING");
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>{t("questionsTitle")}</span>
                    <span className="font-mono text-[10.5px] rounded-full px-2 py-0.5" style={{ background: "color-mix(in srgb, var(--color-ink) 7%, transparent)", color: "var(--color-ink-soft)" }}>{pending.length}</span>
                  </div>
                  {pending.length === 0 ? (
                    <p className="mt-3 text-[12.5px] text-center" style={{ color: "var(--color-muted)" }}>{t("questionsEmpty")}</p>
                  ) : (
                    <div className="mt-3 flex flex-col">
                      {pending.map((q) => (
                        <div key={q.id} className="flex gap-2.5 py-2.5" style={{ borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)" }}>
                          <span className="grid place-items-center rounded-lg font-display text-[11px] font-semibold shrink-0"
                            style={{ width: 28, height: 28, background: q.type === "HAND" ? "var(--color-moss)" : "var(--color-ochre)", color: q.type === "HAND" ? "#f5f2e6" : "var(--color-ink)" }}>
                            {q.userName.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold">
                              {q.userName} <span className="font-mono text-[10px] font-normal" style={{ color: "var(--color-muted)" }}>{q.agendaIndex + 1}. {t("pointShort")}</span>
                            </div>
                            <div className="text-[12.5px] mt-0.5" style={{ color: "var(--color-ink-soft)" }}>
                              {q.type === "HAND" ? t("raisedHand") : q.body}
                            </div>
                          </div>
                          <button onClick={() => markQuestion(q.id)}
                            className="self-center font-mono text-[10px] uppercase tracking-wider rounded-md px-2 py-1 shrink-0"
                            style={{ border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)", color: "var(--color-ink-soft)" }}>
                            {q.type === "HAND" ? t("grantFloor") : t("markRead")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </aside>
      </div>
    </div>
  );
}

function LiveTimer({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = startedAt ? now - new Date(startedAt).getTime() : 0;
  return (
    <span className="font-mono text-sm rounded-lg px-3 py-1.5" style={{ background: "color-mix(in srgb, var(--color-bg) 12%, transparent)" }}>
      {fmtHMS(ms)}
    </span>
  );
}

function VoteControl({
  vote,
  idx,
  agendaLen,
  busy,
  meeting,
  onOpen,
  onClose,
  onPoint,
  t,
}: {
  vote: MeetingVoteResult | undefined;
  idx: number;
  agendaLen: number;
  busy: boolean;
  meeting: MeetingDetailData;
  onOpen: (voteId: string) => void;
  onClose: (voteId: string) => void;
  onPoint: (i: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!vote) {
    return idx < agendaLen - 1 ? (
      <button disabled={busy} onClick={() => onPoint(idx + 1)}
        className="rounded-xl px-5 py-3 font-semibold disabled:opacity-50"
        style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
        {t("nextPoint")} →
      </button>
    ) : null;
  }

  if (vote.status !== "CLOSED") {
    const isOpen = meeting.currentVoteId === vote.id;
    if (!isOpen) {
      return (
        <button disabled={busy} onClick={() => onOpen(vote.id)}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 font-bold disabled:opacity-50"
          style={{ background: "var(--color-moss)", color: "#f5f2e6" }}>
          {t("openVote")}
        </button>
      );
    }
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[11px] font-semibold rounded-full px-3 py-1" style={{ background: "var(--color-ochre)", color: "var(--color-ink)" }}>
            ● {t("voteOpenPill")}
          </span>
        </div>
        <Tally vote={vote} />
        <button disabled={busy} onClick={() => onClose(vote.id)}
          className="mt-4 rounded-xl px-5 py-3.5 font-bold disabled:opacity-50"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
          {t("closeVote")}
        </button>
      </div>
    );
  }

  // closed → result
  return (
    <div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-display font-bold"
        style={
          (vote.award?.outcome === "AWARDED" || vote.passed)
            ? { background: "color-mix(in srgb, var(--color-moss) 14%, var(--color-card))", color: "var(--color-moss)" }
            : { background: "color-mix(in srgb, var(--color-danger) 16%, var(--color-card))", color: "var(--color-danger)" }
        }>
        {vote.award?.outcome === "AWARDED"
          ? `✓ ${t("resultPassed")} — ${vote.award.winnerLabel}`
          : vote.passed
            ? `✓ ${t("resultPassed")}`
            : t("resultDefeated")}
      </div>
      <Tally vote={vote} />
      {idx < agendaLen - 1 && (
        <button disabled={busy} onClick={() => onPoint(idx + 1)}
          className="mt-4 rounded-xl px-5 py-3.5 font-bold disabled:opacity-50"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}>
          {t("nextPoint")} →
        </button>
      )}
    </div>
  );
}

function Tally({ vote }: { vote: MeetingVoteResult }) {
  const total = vote.totalWeight || 0;
  return (
    <div className="flex flex-col gap-3 max-w-xl">
      {vote.options.map((o) => {
        const pct = total > 0 ? (o.weight / total) * 100 : 0;
        return (
          <div key={o.id}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-display font-semibold flex-1">{o.label}</span>
              <span className="font-display font-bold">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-3.5 rounded-lg overflow-hidden" style={{ background: "var(--color-bg-2)" }}>
              <div className="h-full rounded-lg" style={{ width: `${pct}%`, background: "var(--color-moss-2)", transition: "width .5s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetupView({
  meeting,
  format,
  voteMode,
  setFormat,
  setVoteMode,
  busy,
  onStart,
  t,
}: {
  meeting: MeetingDetailData;
  format: Format;
  voteMode: VoteMode;
  setFormat: (f: Format) => void;
  setVoteMode: (v: VoteMode) => void;
  busy: boolean;
  onStart: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const onlineForcesDevice = format === "ONLINE";
  const effectiveVoteMode = onlineForcesDevice ? "DEVICE" : voteMode;

  const Choice = ({ active, onClick, title, desc, disabled }: { active: boolean; onClick: () => void; title: string; desc: string; disabled?: boolean }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className="rounded-xl p-4 text-left transition-colors disabled:opacity-40"
      style={{
        border: `1.5px solid ${active ? "var(--color-ink)" : "color-mix(in srgb, var(--color-ink) 11%, transparent)"}`,
        background: active ? "var(--color-bg-3)" : "var(--color-card)",
      }}>
      <div className="font-display font-semibold">{title}</div>
      <div className="text-[12.5px] mt-0.5" style={{ color: "var(--color-muted)" }}>{desc}</div>
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <span className="font-mono text-[10.5px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>{t("setupEyebrow")}</span>
      <h1 className="font-display mt-3" style={{ fontSize: 40, letterSpacing: "-0.04em" }}>{t("setupHeading")}</h1>
      <p className="mt-3 mb-8" style={{ color: "var(--color-ink-soft)", maxWidth: "54ch" }}>{t("setupLede")}</p>

      <div className="rounded-2xl p-6 mb-4" style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
        <h3 className="font-display text-lg mb-4">{t("formatLabel")}</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(["IN_PERSON", "HYBRID", "ONLINE"] as Format[]).map((f) => (
            <Choice key={f} active={format === f} onClick={() => setFormat(f)} title={t(`format_${f}`)} desc={t(`formatDesc_${f}`)} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 11%, transparent)" }}>
        <h3 className="font-display text-lg mb-4">{t("voteModeLabel")}</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Choice active={effectiveVoteMode === "DEVICE"} onClick={() => setVoteMode("DEVICE")} title={t("voteMode_DEVICE")} desc={t("voteModeDesc_DEVICE")} />
          <Choice active={effectiveVoteMode === "HANDS"} onClick={() => setVoteMode("HANDS")} title={t("voteMode_HANDS")} desc={t("voteModeDesc_HANDS")} disabled={onlineForcesDevice} />
        </div>
        {onlineForcesDevice && (
          <p className="font-mono text-[11.5px] mt-3" style={{ color: "var(--color-ochre)" }}>{t("onlineNoHands")}</p>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-2xl p-5 mb-6" style={{ background: "color-mix(in srgb, var(--color-moss) 14%, var(--color-card))", border: "1px solid color-mix(in srgb, var(--color-moss) 24%, transparent)" }}>
        <div className="flex-1">
          <strong className="font-display" style={{ color: "var(--color-moss)" }}>{t("quorumEstimate")}</strong>
          <p className="text-[13px] mt-1" style={{ color: "var(--color-moss)", opacity: 0.9 }}>
            {t("quorumEstimateBody", { present: meeting.quorum.presentUnitCount, total: meeting.quorum.totalUnitCount })}
          </p>
        </div>
        <div className="font-display font-bold" style={{ fontSize: 32, color: "var(--color-moss)" }}>{meeting.quorum.presentPercentage.toFixed(0)}%</div>
      </div>

      <button onClick={onStart} disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-bold disabled:opacity-50"
        style={{ background: "var(--color-ink)", color: "var(--color-bg)", fontSize: 18 }}>
        ▶ {t("start")}
      </button>
    </div>
  );
}
