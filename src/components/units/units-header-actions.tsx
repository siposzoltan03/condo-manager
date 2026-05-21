"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UnitModal } from "./unit-modal";

interface Props {
  isBoardPlus: boolean;
}

export function UnitsHeaderActions({ isBoardPlus }: Props) {
  const t = useTranslations("units");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!isBoardPlus) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // CSV export not yet implemented; non-blocking placeholder.
        }}
        className="inline-flex items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-60"
        disabled
        style={{
          padding: "9px 14px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-card)",
          color: "var(--color-ink)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          cursor: "not-allowed",
        }}
        title={t("actions.exportSoon")}
      >
        <DownloadIcon /> {t("actions.exportCsv")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
        style={{
          padding: "9px 14px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-ink)",
          cursor: "pointer",
        }}
      >
        <PlusIcon /> {t("actions.newUnit")}
      </button>

      <UnitModal
        open={open}
        unit={null}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
