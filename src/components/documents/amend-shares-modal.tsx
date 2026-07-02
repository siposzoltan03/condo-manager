"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface Row {
  number: string;
  current: number; // fraction 0..1
  nextPct: string; // percent, editable
}

interface CurrentUnit {
  number: string;
  ownershipShare: number;
}
interface ExtractedUnit {
  number: string;
  ownershipShare: number;
}

/**
 * Amend ownership shares (tulajdoni hányad) from a new version of the alapító
 * okirat. Upload the amended deed → AI reads the unit table → review/adjust the
 * old→new share diff → attest (all owners consented + notarial/attorney
 * reference) → apply. The applied shares are stamped with the deed version as
 * provenance and audited server-side. ADMIN-only (the action is gated too).
 */
export function AmendSharesModal({
  documentId,
  onClose,
  onDone,
}: {
  documentId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("documents.amendShares");
  const [phase, setPhase] = useState<"upload" | "processing" | "review">("upload");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") return setError(t("notPdf"));
    if (file.size > 15 * 1024 * 1024) return setError(t("tooLarge"));
    setPhase("processing");
    setBusy(true);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/onboarding/extract-szmsz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: base64,
          fileName: file.name,
          docKind: "FOUNDING_DEED",
          documentId,
        }),
      });
      if (!res.ok) throw new Error(t("extractFailed"));
      const { jobId, versionId: vId } = (await res.json()) as { jobId: string; versionId: string | null };
      setVersionId(vId);
      const extraction = await pollJob(jobId);
      const current = (await fetch("/api/units", { cache: "no-store" }).then((r) => r.json())) as CurrentUnit[];
      const extractedByNumber = new Map(
        (extraction.units ?? []).map((u) => [u.number, u.ownershipShare]),
      );
      const merged: Row[] = current
        .map((u) => {
          const next = extractedByNumber.get(u.number) ?? u.ownershipShare;
          return { number: u.number, current: u.ownershipShare, nextPct: (next * 100).toFixed(2) };
        })
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
      setRows(merged);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("extractFailed"));
      setPhase("upload");
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  async function pollJob(jobId: string): Promise<{ units: ExtractedUnit[] }> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 5 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 2000));
      const r = await fetch(`/api/onboarding/extract-szmsz/${jobId}`, { cache: "no-store" });
      if (!r.ok) continue;
      const d = (await r.json()) as { status: string; result?: { units: ExtractedUnit[] }; error?: string };
      if (d.status === "READY" && d.result) return d.result;
      if (d.status === "FAILED") throw new Error(d.error || t("extractFailed"));
    }
    throw new Error(t("timedOut"));
  }

  const sumPct = rows.reduce((s, r) => s + (parseFloat(r.nextPct) || 0), 0);
  const sumOk = Math.abs(sumPct - 100) <= 0.05;
  const changedCount = rows.filter(
    (r) => Math.abs((parseFloat(r.nextPct) || 0) / 100 - r.current) > 0.00005,
  ).length;

  function setRowPct(number: string, value: string) {
    setRows((prev) => prev.map((r) => (r.number === number ? { ...r, nextPct: value } : r)));
  }

  async function submit() {
    setError(null);
    if (!confirmed) return setError(t("needAttestation"));
    if (!reference.trim()) return setError(t("needReference"));
    if (!sumOk) return setError(t("sumBad", { pct: sumPct.toFixed(2) }));
    if (!versionId) return setError(t("extractFailed"));
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/amend-shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          units: rows.map((r) => ({ number: r.number, ownershipShare: (parseFloat(r.nextPct) || 0) / 100 })),
          attestation: { reference: reference.trim() },
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? t("submitFailed"));
        return;
      }
      onDone();
    } catch {
      setError(t("submitFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", padding: "24px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl"
        style={{ background: "var(--color-bg)", width: "min(640px, 100%)", maxHeight: "88vh", overflow: "auto", padding: "24px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 style={{ fontSize: "19px", fontWeight: 600, letterSpacing: "-0.02em" }}>{t("title")}</h2>
            <p style={{ fontSize: "13px", color: "var(--color-ink-soft)", margin: "4px 0 0", maxWidth: "56ch" }}>{t("intro")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ fontSize: "20px", lineHeight: 1, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        {phase === "upload" && (
          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{ padding: "10px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--color-ink)", color: "var(--color-bg)", border: "none", cursor: "pointer" }}
            >
              {t("uploadCta")}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <p className="font-mono" style={{ fontSize: "10.5px", color: "var(--color-muted)", marginTop: "10px" }}>{t("gdprNote")}</p>
          </div>
        )}

        {phase === "processing" && (
          <p style={{ marginTop: "22px", fontSize: "14px", color: "var(--color-ink-soft)" }}>{t("processing", { s: elapsed })}</p>
        )}

        {phase === "review" && (
          <div style={{ marginTop: "18px" }}>
            <div style={{ maxHeight: "320px", overflow: "auto", borderRadius: "10px", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--color-bg-3)", textAlign: "left", position: "sticky", top: 0 }}>
                    <Th>{t("colUnit")}</Th>
                    <Th align="right">{t("colCurrent")}</Th>
                    <Th align="right">{t("colNew")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const next = parseFloat(r.nextPct) || 0;
                    const changed = Math.abs(next / 100 - r.current) > 0.00005;
                    return (
                      <tr key={r.number} style={{ borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)", background: changed ? "color-mix(in srgb, var(--color-moss) 8%, transparent)" : "transparent" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>{r.number}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--color-muted)" }}>{(r.current * 100).toFixed(2)}%</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>
                          <input
                            type="number" step="0.01" min="0" max="100"
                            value={r.nextPct}
                            onChange={(e) => setRowPct(r.number, e.target.value)}
                            style={{ width: "84px", textAlign: "right", padding: "4px 6px", borderRadius: "6px", border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: "13px" }}
                          />%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between" style={{ marginTop: "10px", fontSize: "13px" }}>
              <span style={{ color: "var(--color-ink-soft)" }}>{t("changedCount", { count: changedCount })}</span>
              <span style={{ fontWeight: 700, color: sumOk ? "var(--color-moss)" : "var(--color-danger)" }}>
                {t("sumLabel")}: {sumPct.toFixed(2)}%
              </span>
            </div>

            <label className="flex items-start gap-2" style={{ marginTop: "16px", fontSize: "13px", cursor: "pointer" }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: "2px" }} />
              <span>{t("attestation")}</span>
            </label>

            <div style={{ marginTop: "12px" }}>
              <label className="block" style={{ fontSize: "13px", fontWeight: 600, marginBottom: "5px" }}>{t("referenceLabel")}</label>
              <input
                type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder={t("referencePlaceholder")}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: "13px" }}
              />
            </div>

            <div className="flex items-center justify-end gap-3" style={{ marginTop: "20px" }}>
              <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--color-bg-3)", color: "var(--color-ink)", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)", cursor: "pointer" }}>{t("cancel")}</button>
              <button type="button" onClick={submit} disabled={busy || !sumOk || !confirmed || changedCount === 0}
                style={{ padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, background: "var(--color-ink)", color: "var(--color-bg)", border: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy || !sumOk || !confirmed || changedCount === 0 ? 0.5 : 1 }}>
                {busy ? t("submitting") : t("submit")}
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" style={{ marginTop: "14px", fontSize: "13px", color: "var(--color-danger)" }}>{error}</p>}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className="font-mono" style={{ padding: "8px 10px", fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, textAlign: align ?? "left" }}>
      {children}
    </th>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
