"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScheduledMaintenanceModal } from "./scheduled-maintenance-modal";

export function ScheduledHeaderActions() {
  const t = useTranslations("maintenance");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
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
        <PlusIcon />
        {t("scheduled.addEntry")}
      </button>

      <ScheduledMaintenanceModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
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
