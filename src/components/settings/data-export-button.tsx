"use client";

import { useState } from "react";

/**
 * GDPR Art. 15 self-service export. Styled to match the settings
 * QuickAction rows; hitting the endpoint streams a JSON attachment, so the
 * browser downloads it without navigating away.
 */
export function DataExportButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);

  function onClick() {
    setBusy(true);
    // Content-Disposition: attachment ⇒ this downloads rather than navigates.
    window.location.href = "/api/me/data-export";
    // Re-enable shortly; the download doesn't unload the page.
    window.setTimeout(() => setBusy(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex justify-between transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{
        padding: "9px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        background: "var(--color-card)",
        color: "var(--color-ink)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        cursor: busy ? "wait" : "pointer",
        textAlign: "left",
      }}
    >
      <span>{label}</span>
      <span style={{ color: "var(--color-muted)" }}>↓</span>
    </button>
  );
}
