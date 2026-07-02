"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DocVersionLite } from "@/lib/documents-dal";

interface DiffPart {
  value: string;
  added: boolean;
  removed: boolean;
}
interface CompareResult {
  a: { versionNumber: number; hasText: boolean };
  b: { versionNumber: number; hasText: boolean };
  diff: DiffPart[];
}

/**
 * Compare two document versions as a line diff. Rendered in the version panel
 * when a document has ≥2 versions. Text is extracted server-side (cached).
 */
export function VersionCompare({
  documentId,
  versions,
}: {
  documentId: string;
  versions: DocVersionLite[];
}) {
  const t = useTranslations("documents.compare");
  const [open, setOpen] = useState(false);
  // versions are newest-first; default to older → newer so additions show green.
  const [aId, setAId] = useState(versions[1]?.id ?? "");
  const [bId, setBId] = useState(versions[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  if (versions.length < 2) return null;

  async function run() {
    if (aId === bId) {
      setError(t("samePicked"));
      setResult(null);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/compare?a=${aId}&b=${bId}`);
      if (!res.ok) {
        setError(t("failed"));
        return;
      }
      setResult((await res.json()) as CompareResult);
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  const noText = result && !result.a.hasText && !result.b.hasText;
  const noChanges = result && !noText && !result.diff.some((p) => p.added || p.removed);

  return (
    <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-mono"
        style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-soft)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {open ? "▾ " : "▸ "}{t("title")}
      </button>

      {open && (
        <div style={{ marginTop: "10px" }}>
          <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: "12px" }}>
            <select value={aId} onChange={(e) => setAId(e.target.value)} style={selectStyle}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>v{v.versionNumber}</option>
              ))}
            </select>
            <span style={{ color: "var(--color-muted)" }}>→</span>
            <select value={bId} onChange={(e) => setBId(e.target.value)} style={selectStyle}>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>v{v.versionNumber}</option>
              ))}
            </select>
            <button type="button" onClick={run} disabled={busy} style={compareBtn}>
              {busy ? t("processing") : t("compareBtn")}
            </button>
          </div>

          {error && <p style={{ fontSize: "12px", color: "var(--color-danger)", marginTop: "8px" }}>{error}</p>}
          {noText && <p style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "8px" }}>{t("noText")}</p>}
          {noChanges && <p style={{ fontSize: "12px", color: "var(--color-moss)", marginTop: "8px" }}>{t("noChanges")}</p>}

          {result && !noText && !noChanges && (
            <div
              style={{
                marginTop: "10px",
                maxHeight: "360px",
                overflow: "auto",
                borderRadius: "8px",
                border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "11.5px",
                lineHeight: 1.5,
              }}
            >
              {result.diff.map((part, i) => (
                <DiffBlock key={i} part={part} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffBlock({ part }: { part: DiffPart }) {
  const bg = part.added
    ? "color-mix(in srgb, var(--color-moss) 14%, transparent)"
    : part.removed
      ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
      : "transparent";
  const sign = part.added ? "+" : part.removed ? "−" : " ";
  const color = part.added ? "var(--color-moss)" : part.removed ? "var(--color-danger)" : "var(--color-ink-soft)";
  // Trailing newline produces an empty final line — drop it.
  const lines = part.value.replace(/\n$/, "").split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} style={{ background: bg, padding: "1px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          <span style={{ color, userSelect: "none", opacity: 0.7 }}>{sign} </span>
          {line}
        </div>
      ))}
    </>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: "7px",
  fontSize: "12px",
  border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)",
  background: "var(--color-bg)",
  color: "var(--color-ink)",
};
const compareBtn: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: "7px",
  fontSize: "12px",
  fontWeight: 600,
  background: "var(--color-ink)",
  color: "var(--color-bg)",
  border: "none",
  cursor: "pointer",
};
