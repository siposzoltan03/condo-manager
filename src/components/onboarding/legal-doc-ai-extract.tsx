"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

export interface ExtractedUnit {
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
}
export interface ExtractedGovernance {
  reserveTargetHUF: number | null;
  defaultMajority: string | null;
  costAllocationBasis: string | null;
}
export interface Extraction {
  units: ExtractedUnit[];
  governance: ExtractedGovernance | null;
  stored?: boolean;
}

/** Document kinds the onboarding uploader can extract from. */
export type ExtractDocKind = "FOUNDING_DEED" | "SZMSZ" | "COMBINED";

/**
 * Legal-document upload + AI extraction, scoped to a document kind. The founding
 * deed (alapító okirat) yields units + ownership shares; the SZMSZ yields
 * governance; a combined document yields both. On success it lifts the result
 * to the wizard (via onExtracted) so the Units / Governance steps can pre-fill,
 * and the extraction survives step navigation. The uploaded PDF is also stored
 * server-side in its matching category (onReload refreshes the doc count).
 */
export function LegalDocAiExtract({
  locale,
  docKind,
  extraction,
  onExtracted,
  onReload,
}: {
  locale: string;
  docKind: ExtractDocKind;
  extraction: Extraction | null;
  onExtracted: (e: Extraction) => void;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("buildingOnboarding.ai");
  const tg = useTranslations("buildingOnboarding");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "hu-HU");
  const isSzmsz = docKind === "SZMSZ";
  const title = t(isSzmsz ? "szmszTitle" : "deedTitle");
  const subtitle = t(isSzmsz ? "szmszSubtitle" : "deedSubtitle");
  const uploadCta = t(isSzmsz ? "szmszUploadCta" : "deedUploadCta");

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError(t("notPdf"));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(t("tooLarge"));
      return;
    }
    setBusy(true);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const base64 = await fileToBase64(file);
      // Start the background job for this document kind.
      const res = await fetch("/api/onboarding/extract-szmsz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name, docKind }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? t("extractFailed"));
        return;
      }
      const { jobId, stored } = (await res.json()) as { jobId: string; stored: boolean };
      // Poll until the worker finishes (up to 5 min).
      const result = await pollJob(jobId);
      onExtracted({ ...result, stored });
      await onReload(); // stored doc → refresh the doc count
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("extractFailed"));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  async function pollJob(jobId: string): Promise<Extraction> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 5 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 2000));
      const r = await fetch(`/api/onboarding/extract-szmsz/${jobId}`, { cache: "no-store" });
      if (!r.ok) continue;
      const d = (await r.json()) as { status: string; result?: Extraction; error?: string };
      if (d.status === "READY" && d.result) return d.result;
      if (d.status === "FAILED") throw new Error(d.error || t("extractFailed"));
    }
    throw new Error(t("timedOut"));
  }

  const units = extraction?.units ?? [];
  const shareSum = units.reduce((s, u) => s + (u.ownershipShare || 0), 0);
  const g = extraction?.governance;
  const hasGov = !!g && (g.reserveTargetHUF != null || !!g.defaultMajority || !!g.costAllocationBasis);
  // Show the summary once this upload has produced its relevant section.
  const showSummary = isSzmsz ? hasGov : units.length > 0;

  return (
    <div
      className="rounded-xl"
      style={{
        marginBottom: "16px",
        padding: "16px 18px",
        background: "color-mix(in srgb, var(--color-blue) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-blue) 25%, transparent)",
      }}
    >
      <div
        className="font-mono"
        style={{ fontSize: "10px", color: "var(--color-blue)", letterSpacing: "0.1em", textTransform: "uppercase" }}
      >
        {t("eyebrow")}
      </div>
      <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "3px" }}>{title}</div>
      <p style={{ fontSize: "13px", color: "var(--color-ink-soft)", margin: "3px 0 0", maxWidth: "56ch" }}>
        {subtitle}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
        style={{
          marginTop: "12px",
          padding: "9px 14px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy
          ? t("extractingElapsed", { s: elapsed })
          : showSummary
            ? t("reupload")
            : uploadCta}
      </button>
      {busy && (
        <p style={{ fontSize: "12px", color: "var(--color-ink-soft)", marginTop: "8px" }}>
          {t("processingNote")}
        </p>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        disabled={busy}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <p className="font-mono" style={{ fontSize: "10.5px", color: "var(--color-muted)", marginTop: "8px", letterSpacing: "0.02em" }}>
        {t("gdprNote")}
      </p>

      {error && (
        <div role="alert" style={{ marginTop: "10px", fontSize: "13px", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}

      {showSummary && (
        <div
          className="rounded-lg"
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          }}
        >
          {units.length > 0 && (
            <div style={{ fontSize: "13px", fontWeight: 600 }}>
              {t("summaryUnits", {
                count: units.length,
                pct: (shareSum * 100).toLocaleString(locale === "en" ? "en-US" : "hu-HU", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })}
            </div>
          )}
          {hasGov && (
            <ul style={{ fontSize: "13px", margin: units.length > 0 ? "6px 0 0" : 0, paddingLeft: "16px", listStyle: "disc", color: "var(--color-ink-soft)" }}>
              {g!.reserveTargetHUF != null && (
                <li>{t("govReserve", { amount: nf.format(g!.reserveTargetHUF) })}</li>
              )}
              {g!.defaultMajority && (
                <li>{t("govMajority")}: {tg(`majority.${g!.defaultMajority}`)}</li>
              )}
              {g!.costAllocationBasis && (
                <li>{t("govCostBasis")}: {tg(`costBasis.${g!.costAllocationBasis}`)}</li>
              )}
            </ul>
          )}
          <p style={{ fontSize: "12px", color: "var(--color-moss)", margin: "8px 0 0" }}>
            {extraction?.stored ? `✓ ${t("stored")}` : ""} {t("reviewNext")}
          </p>
        </div>
      )}
    </div>
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
