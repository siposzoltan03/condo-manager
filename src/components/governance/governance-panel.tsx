"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { proposeBylawsChange } from "@/app/actions/bylaws";
import type { GovernanceOverview } from "@/lib/governance-dal";

const MAJORITY = ["SIMPLE_MAJORITY", "TWO_THIRDS", "FOUR_FIFTHS", "UNANIMOUS"] as const;
const COST_BASIS = ["OWNERSHIP_SHARE", "EQUAL", "AREA"] as const;

export function GovernancePanel({
  locale,
  data,
}: {
  locale: string;
  data: GovernanceOverview;
}) {
  const t = useTranslations("governance");
  const tg = useTranslations("buildingOnboarding");
  const router = useRouter();
  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "hu-HU");

  const [open, setOpen] = useState(false);
  const [reserve, setReserve] = useState("");
  const [majority, setMajority] = useState(""); // "" = no change
  const [basis, setBasis] = useState("");
  const [voteMajority, setVoteMajority] = useState("TWO_THIRDS");
  const [meetingId, setMeetingId] = useState(data.upcomingMeetings[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const hasChange = reserve.trim() !== "" || majority !== "" || basis !== "";

  async function submit() {
    setBusy(true);
    try {
      const res = await proposeBylawsChange({
        meetingId,
        reserveTargetHUF: reserve.trim() !== "" ? Number(reserve) : null,
        defaultMajority: majority || null,
        costAllocationBasis: basis || null,
        voteMajorityType: voteMajority,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("proposeSuccess"));
      setOpen(false);
      setReserve(""); setMajority(""); setBasis("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 28px 80px" }}>
      <h1 style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: "32px", fontWeight: 500, letterSpacing: "-0.03em" }}>
        {t("title")}
      </h1>
      <p style={{ color: "var(--color-ink-soft)", margin: "6px 0 24px", maxWidth: "60ch" }}>{t("subtitle")}</p>

      {/* Current settings */}
      <div style={card}>
        <SettingRow label={t("reserveTarget")} value={`${nf.format(data.reserveTargetHUF)} Ft`} />
        <SettingRow label={t("majority")} value={tg(`majority.${data.defaultMajority}`)} />
        <SettingRow label={t("costBasis")} value={tg(`costBasis.${data.costAllocationBasis}`)} last />
      </div>

      {/* Propose */}
      {data.canPropose && (
        <div style={{ marginTop: "18px" }}>
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} style={primaryBtn}>
              {t("proposeCta")}
            </button>
          ) : (
            <div style={card}>
              <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{t("proposeTitle")}</div>
              <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-muted)", margin: "0 0 14px", letterSpacing: "0.02em" }}>
                {t("assemblyNote")}
              </p>

              <Field label={t("reserveTarget")}>
                <input type="number" min={0} step={100000} value={reserve} onChange={(e) => setReserve(e.target.value)} placeholder={t("noChange")} style={input} />
              </Field>
              <Field label={t("majority")}>
                <select value={majority} onChange={(e) => setMajority(e.target.value)} style={input}>
                  <option value="">{t("noChange")}</option>
                  {MAJORITY.map((m) => <option key={m} value={m}>{tg(`majority.${m}`)}</option>)}
                </select>
              </Field>
              <Field label={t("costBasis")}>
                <select value={basis} onChange={(e) => setBasis(e.target.value)} style={input}>
                  <option value="">{t("noChange")}</option>
                  {COST_BASIS.map((c) => <option key={c} value={c}>{tg(`costBasis.${c}`)}</option>)}
                </select>
              </Field>

              <div style={{ height: "1px", background: "color-mix(in srgb, var(--color-ink) 8%, transparent)", margin: "8px 0 14px" }} />

              <Field label={t("voteMajority")} hint={t("voteMajorityHint")}>
                <select value={voteMajority} onChange={(e) => setVoteMajority(e.target.value)} style={input}>
                  {MAJORITY.map((m) => <option key={m} value={m}>{tg(`majority.${m}`)}</option>)}
                </select>
              </Field>
              <Field label={t("meeting")}>
                {data.upcomingMeetings.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "var(--color-ochre)" }}>{t("noMeeting")}</p>
                ) : (
                  <select value={meetingId} onChange={(e) => setMeetingId(e.target.value)} style={input}>
                    {data.upcomingMeetings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} · {new Date(m.date).toLocaleDateString(locale === "en" ? "en-US" : "hu-HU")}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <div className="flex gap-2" style={{ marginTop: "12px" }}>
                <button type="button" onClick={submit} disabled={busy || !hasChange || !meetingId} style={{ ...primaryBtn, opacity: !hasChange || !meetingId ? 0.5 : 1 }}>
                  {busy ? "…" : t("submitProposal")}
                </button>
                <button type="button" onClick={() => setOpen(false)} disabled={busy} style={ghostBtn}>{t("cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proposals history */}
      <div style={{ marginTop: "26px" }}>
        <h2 className="font-mono" style={{ fontSize: "11px", color: "var(--color-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>
          {t("proposalsTitle")}
        </h2>
        {data.proposals.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>{t("noProposals")}</p>
        ) : (
          <div className="grid gap-2">
            {data.proposals.map((p) => (
              <div key={p.id} style={{ ...card, padding: "12px 14px" }} className="flex items-center justify-between gap-3">
                <div style={{ fontSize: "13px" }}>
                  <div style={{ fontWeight: 600 }}>
                    {[
                      p.reserveTargetHUF != null ? `${t("reserveTarget")}: ${nf.format(p.reserveTargetHUF)} Ft` : null,
                      p.defaultMajority ? tg(`majority.${p.defaultMajority}`) : null,
                      p.costAllocationBasis ? tg(`costBasis.${p.costAllocationBasis}`) : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <div className="font-mono" style={{ fontSize: "10.5px", color: "var(--color-muted)", marginTop: "2px" }}>
                    {new Date(p.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "hu-HU")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} label={t(`status.${p.status}`)} />
                  {p.status === "PENDING_VOTE" && p.voteId && (
                    <Link href={`/${locale}/voting`} style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-blue)" }}>
                      {t("openVote")} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: last ? "none" : "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)" }}>
      <span style={{ fontSize: "13px", color: "var(--color-ink-soft)" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label className="block" style={{ fontSize: "13px", fontWeight: 600, marginBottom: "5px" }}>{label}</label>
      {children}
      {hint && <p className="font-mono" style={{ fontSize: "10.5px", color: "var(--color-muted)", marginTop: "4px" }}>{hint}</p>}
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color =
    status === "APPLIED" ? "var(--color-moss)" : status === "REJECTED" || status === "CANCELLED" ? "var(--color-danger)" : "var(--color-ochre)";
  return (
    <span className="font-mono" style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color, padding: "3px 8px", borderRadius: "6px", background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {label}
    </span>
  );
}

const card: React.CSSProperties = { background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)", borderRadius: "14px", padding: "18px 20px" };
const input: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: "9px", fontSize: "14px", border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)", background: "var(--color-bg)", color: "var(--color-ink)" };
const primaryBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--color-ink)", color: "var(--color-bg)", border: "none", cursor: "pointer" };
const ghostBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--color-card)", color: "var(--color-ink)", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)", cursor: "pointer" };
