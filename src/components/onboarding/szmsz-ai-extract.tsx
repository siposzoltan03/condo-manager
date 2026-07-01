"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

export interface ExtractedUnit {
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
}
export interface Extraction {
  units: ExtractedUnit[];
  governance: {
    reserveTargetHUF: number | null;
    defaultMajority: string | null;
    costAllocationBasis: string | null;
  };
  stored?: boolean;
}

/**
 * SZMSZ upload + AI extraction. On success it lifts the result to the wizard
 * (via onExtracted) so the Units and Governance steps can pre-fill from it,
 * and the extraction survives step navigation. The uploaded PDF is also stored
 * server-side in the Bylaws category (onReload refreshes the doc count).
 */
export function SzmszAiExtract({
  locale,
  extraction,
  onExtracted,
  onReload,
}: {
  locale: string;
  extraction: Extraction | null;
  onExtracted: (e: Extraction) => void;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("buildingOnboarding.ai");
  const tg = useTranslations("buildingOnboarding");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "hu-HU");

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
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/onboarding/extract-szmsz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? t("extractFailed"));
        return;
      }
      const result = (await res.json()) as Extraction;
      onExtracted(result);
      await onReload(); // stored doc → refresh the doc count
    } catch {
      setError(t("extractFailed"));
    } finally {
      setBusy(false);
    }
  }

  const shareSum =
    extraction?.units.reduce((s, u) => s + (u.ownershipShare || 0), 0) ?? 0;
  const g = extraction?.governance;

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
      <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "3px" }}>{t("title")}</div>
      <p style={{ fontSize: "13px", color: "var(--color-ink-soft)", margin: "3px 0 0", maxWidth: "56ch" }}>
        {t("subtitle")}
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
        {busy ? t("extracting") : extraction ? t("reupload") : t("uploadCta")}
      </button>
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

      {extraction && (
        <div
          className="rounded-lg"
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600 }}>
            {t("summaryUnits", {
              count: extraction.units.length,
              pct: (shareSum * 100).toLocaleString(locale === "en" ? "en-US" : "hu-HU", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            })}
          </div>
          {g && (g.reserveTargetHUF != null || g.defaultMajority || g.costAllocationBasis) && (
            <ul style={{ fontSize: "13px", margin: "6px 0 0", paddingLeft: "16px", listStyle: "disc", color: "var(--color-ink-soft)" }}>
              {g.reserveTargetHUF != null && (
                <li>{t("govReserve", { amount: nf.format(g.reserveTargetHUF) })}</li>
              )}
              {g.defaultMajority && (
                <li>{t("govMajority")}: {tg(`majority.${g.defaultMajority}`)}</li>
              )}
              {g.costAllocationBasis && (
                <li>{t("govCostBasis")}: {tg(`costBasis.${g.costAllocationBasis}`)}</li>
              )}
            </ul>
          )}
          <p style={{ fontSize: "12px", color: "var(--color-moss)", margin: "8px 0 0" }}>
            {extraction.stored ? `✓ ${t("stored")}` : ""} {t("reviewNext")}
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
