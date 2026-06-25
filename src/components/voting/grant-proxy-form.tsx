"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  ProxyCandidateUser,
  ProxyOverviewData,
} from "@/lib/voting-dal";

interface Props {
  candidates: ProxyCandidateUser[];
  openVotes: ProxyOverviewData["openVotes"];
  nextMeeting: ProxyOverviewData["nextMeeting"];
  isOwner: boolean;
}

/**
 * Grant a proxy to another owner. Pure form-on-card; the call goes to
 * /api/voting/proxy and we router.refresh() on success so the server-rendered
 * list updates with the new assignment.
 */
export function GrantProxyForm({ candidates, openVotes, nextMeeting, isOwner }: Props) {
  const t = useTranslations("voting.proxy");
  const router = useRouter();
  const [granteeId, setGranteeId] = useState("");
  const [scope, setScope] = useState<"general" | "specific">("general");
  const [voteId, setVoteId] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    if (nextMeeting) {
      // Default to end-of-day for the next meeting.
      const d = new Date(nextMeeting.startsAt);
      d.setHours(23, 59);
      return d.toISOString().slice(0, 16);
    }
    return "";
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!granteeId) errs.grantee = t("errorGranteeRequired");
    if (scope === "specific" && !voteId) errs.vote = t("errorVoteRequired");
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/voting/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          granteeId,
          voteId: scope === "specific" ? voteId : null,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || t("errorSubmit") });
        return;
      }
      toast.success(t("granted"));
      setGranteeId("");
      setScope("general");
      setVoteId("");
      router.refresh();
    } catch {
      setErrors({ submit: t("errorSubmit") });
    } finally {
      setSubmitting(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-ibm-plex-mono), monospace",
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--color-muted)",
    marginBottom: "6px",
    display: "block",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "13.5px",
    color: "var(--color-ink)",
    background: "var(--color-bg-3)",
    border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    borderRadius: "8px",
    outline: "none",
    fontFamily: "inherit",
  };

  if (!isOwner) {
    return (
      <div
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          padding: "12px 14px",
          background: "color-mix(in srgb, var(--color-ink) 4%, transparent)",
          borderRadius: "8px",
        }}
      >
        {t("notOwnerNotice")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {errors.submit && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "12.5px",
            background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
            marginBottom: "14px",
          }}
        >
          {errors.submit}
        </div>
      )}

      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="proxy-grantee" style={labelStyle}>
          {t("fieldGrantee")}
        </label>
        <select
          id="proxy-grantee"
          value={granteeId}
          onChange={(e) => {
            setGranteeId(e.target.value);
            clearError("grantee");
          }}
          style={{
            ...inputStyle,
            ...(errors.grantee
              ? {
                  borderColor: "var(--color-danger)",
                  background:
                    "color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-3))",
                }
              : {}),
          }}
        >
          <option value="">{t("selectGrantee")}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.email})
            </option>
          ))}
        </select>
        {errors.grantee && (
          <div
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-danger)",
              marginTop: "5px",
              letterSpacing: "0.04em",
            }}
          >
            {errors.grantee}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>{t("fieldScope")}</label>
        <div className="flex gap-1" style={{ background: "var(--color-bg-3)", padding: "3px", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)" }}>
          {(["general", "specific"] as const).map((opt) => {
            const isOn = scope === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setScope(opt);
                  if (opt === "general") setVoteId("");
                  clearError("vote");
                }}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  fontSize: "12px",
                  fontWeight: isOn ? 600 : 500,
                  color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                  background: isOn ? "var(--color-ink)" : "transparent",
                  border: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {opt === "general" ? t("scopeGeneral") : t("scopeSpecific")}
              </button>
            );
          })}
        </div>
      </div>

      {scope === "specific" && (
        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="proxy-vote" style={labelStyle}>
            {t("fieldVote")}
          </label>
          <select
            id="proxy-vote"
            value={voteId}
            onChange={(e) => {
              setVoteId(e.target.value);
              clearError("vote");
            }}
            style={{
              ...inputStyle,
              ...(errors.vote
                ? {
                    borderColor: "var(--color-danger)",
                    background:
                      "color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-3))",
                  }
                : {}),
            }}
          >
            <option value="">{t("selectVote")}</option>
            {openVotes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
          {openVotes.length === 0 && (
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                marginTop: "5px",
                letterSpacing: "0.04em",
              }}
            >
              {t("noOpenVotes")}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: "14px" }}>
        <label htmlFor="proxy-valid-until" style={labelStyle}>
          {t("fieldValidUntil")}
        </label>
        <input
          id="proxy-valid-until"
          type="datetime-local"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          style={inputStyle}
        />
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            marginTop: "5px",
            letterSpacing: "0.04em",
          }}
        >
          {t("validUntilHint")}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || candidates.length === 0}
        className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 w-full"
        style={{
          padding: "11px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-ink)",
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? t("granting") : t("grantCta")}
      </button>
    </form>
  );
}
