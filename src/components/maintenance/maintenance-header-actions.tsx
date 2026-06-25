"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ReportIssueModal } from "./ReportIssueModal";

interface Props {
  isBoardPlus: boolean;
}

/**
 * Client wrapper for the maintenance page-header actions: opens the
 * Tiles-styled ReportIssueModal. Board+ also see a "Szerelő hozzáadása" link.
 */
export function MaintenanceHeaderActions({ isBoardPlus }: Props) {
  const t = useTranslations("maintenance");
  const locale = useLocale();
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      {isBoardPlus && (
        <Link
          href={`/${locale}/maintenance/contractors`}
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{
            padding: "9px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: "var(--color-card)",
            color: "var(--color-ink)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <PlusCircleIcon />
          {t("actions.addContractor")}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setReportOpen(true)}
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
        <PlusIcon />
        {t("actions.report")}
      </button>

      <ReportIssueModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onCreated={() => {
          setReportOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
