"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { importUnits } from "@/app/actions/units";
import type { ImportRow } from "@/lib/import/types";

interface ExtractedUnit {
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
}
interface Extraction {
  units: ExtractedUnit[];
  governance: {
    reserveTargetHUF: number | null;
    defaultMajority: string | null;
    costAllocationBasis: string | null;
  };
}

const SHARE_EPS = 0.0001;

export function SzmszAiExtract({
  locale,
  onReload,
}: {
  locale: string;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("buildingOnboarding.ai");
  const [busy, setBusy] = useState<"idle" | "extracting" | "importing" | "gov">("idle");
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [govMsg, setGovMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nf = new Intl.NumberFormat(locale === "en" ? "en-US" : "hu-HU");

  async function handleFile(file: File) {
    setError(null);
    setExtraction(null);
    setImportMsg(null);
    setGovMsg(null);
    if (file.type !== "application/pdf") {
      setError(t("notPdf"));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(t("tooLarge"));
      return;
    }
    setBusy("extracting");
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
      setExtraction((await res.json()) as Extraction);
    } catch {
      setError(t("extractFailed"));
    } finally {
      setBusy("idle");
    }
  }

  const shareSum =
    extraction?.units.reduce((s, u) => s + (u.ownershipShare || 0), 0) ?? 0;
  const sharesComplete = Math.abs(shareSum - 1) <= SHARE_EPS;

  async function handleImport() {
    if (!extraction) return;
    setImportMsg(null);
    setBusy("importing");
    try {
      const rows: ImportRow[] = extraction.units.map((u) => ({
        unit_number: u.number,
        floor: String(u.floor),
        size_sqm: String(u.size),
        ownership_share: String(u.ownershipShare),
      }));
      const result = await importUnits(rows);
      if (result.created > 0) {
        setImportMsg(t("imported", { count: result.created }));
        await onReload();
      } else {
        const first = result.errors[0]?.message;
        setImportMsg(first ? `${t("importNone")} — ${first}` : t("importNone"));
      }
    } catch {
      setImportMsg(t("importError"));
    } finally {
      setBusy("idle");
    }
  }

  async function handleApplyGovernance() {
    if (!extraction) return;
    const g = extraction.governance;
    const payload: Record<string, unknown> = { action: "governance" };
    if (g.reserveTargetHUF != null) payload.reserveTargetHUF = g.reserveTargetHUF;
    if (g.defaultMajority) payload.defaultMajority = g.defaultMajority;
    if (g.costAllocationBasis) payload.costAllocationBasis = g.costAllocationBasis;
    if (Object.keys(payload).length === 1) {
      setGovMsg(t("govNone"));
      return;
    }
    setGovMsg(null);
    setBusy("gov");
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setGovMsg(t("govError"));
        return;
      }
      setGovMsg(t("govApplied"));
      await onReload();
    } catch {
      setGovMsg(t("govError"));
    } finally {
      setBusy("idle");
    }
  }

  const hasGovernance =
    !!extraction &&
    (extraction.governance.reserveTargetHUF != null ||
      !!extraction.governance.defaultMajority ||
      !!extraction.governance.costAllocationBasis);

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
      <div className="flex items-start justify-between gap-3">
        <div>
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
        </div>
      </div>

      <button
        type="button"
        disabled={busy !== "idle"}
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
          cursor: busy === "idle" ? "pointer" : "not-allowed",
          opacity: busy === "extracting" ? 0.6 : 1,
        }}
      >
        {busy === "extracting" ? t("extracting") : t("uploadCta")}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        disabled={busy !== "idle"}
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
        <div style={{ marginTop: "14px" }}>
          {/* Units review */}
          <div className="flex items-center justify-between" style={{ marginBottom: "6px" }}>
            <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {t("unitsFound", { count: extraction.units.length })}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: "11px", fontWeight: 600, color: sharesComplete ? "var(--color-moss)" : "var(--color-ochre)" }}
            >
              {t("shareSum", { pct: (shareSum * 100).toLocaleString(locale === "en" ? "en-US" : "hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
            </span>
          </div>

          <div style={{ maxHeight: "240px", overflowY: "auto", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead>
                <tr style={{ background: "var(--color-bg-3)", textAlign: "left" }}>
                  <Th>{t("colNumber")}</Th>
                  <Th>{t("colFloor")}</Th>
                  <Th>{t("colSize")}</Th>
                  <Th>{t("colShare")}</Th>
                </tr>
              </thead>
              <tbody>
                {extraction.units.map((u, i) => (
                  <tr key={`${u.number}-${i}`} style={{ borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)" }}>
                    <Td>{u.number}</Td>
                    <Td>{u.floor}</Td>
                    <Td>{nf.format(u.size)} m²</Td>
                    <Td>{(u.ownershipShare * 100).toLocaleString(locale === "en" ? "en-US" : "hu-HU", { maximumFractionDigits: 4 })}%</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "12px" }}>
            <button
              type="button"
              onClick={handleImport}
              disabled={busy !== "idle" || extraction.units.length === 0}
              className="transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ padding: "9px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--color-ink)", color: "var(--color-bg)" }}
            >
              {busy === "importing" ? t("importing") : t("importCta")}
            </button>
            {importMsg && <span style={{ fontSize: "13px", color: "var(--color-ink-soft)" }}>{importMsg}</span>}
          </div>
          {!sharesComplete && (
            <p style={{ fontSize: "12px", color: "var(--color-ochre)", marginTop: "6px" }}>{t("shareWarning")}</p>
          )}

          {/* Governance review */}
          {hasGovernance && (
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)" }}>
              <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {t("governanceFound")}
              </span>
              <ul style={{ fontSize: "13px", margin: "6px 0 0", paddingLeft: "16px", listStyle: "disc" }}>
                {extraction.governance.reserveTargetHUF != null && (
                  <li>{t("govReserve", { amount: nf.format(extraction.governance.reserveTargetHUF) })}</li>
                )}
                {extraction.governance.defaultMajority && (
                  <li>{t("govMajority")}: {extraction.governance.defaultMajority}</li>
                )}
                {extraction.governance.costAllocationBasis && (
                  <li>{t("govCostBasis")}: {extraction.governance.costAllocationBasis}</li>
                )}
              </ul>
              <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={handleApplyGovernance}
                  disabled={busy !== "idle"}
                  className="transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ padding: "9px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: "var(--color-card)", color: "var(--color-ink)", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)" }}
                >
                  {busy === "gov" ? t("applying") : t("applyGovCta")}
                </button>
                {govMsg && <span style={{ fontSize: "13px", color: "var(--color-ink-soft)" }}>{govMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-mono" style={{ padding: "7px 10px", fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "6px 10px" }}>{children}</td>;
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
