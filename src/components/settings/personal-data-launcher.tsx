"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PersonalDataModal } from "./personal-data-modal";

interface Props {
  initial: {
    phone: string | null;
    secondaryEmail: string | null;
    birthDate: string | null;
    permanentAddress: string | null;
    mailingAddress: string | null;
  };
}

export function PersonalDataLauncher({ initial }: Props) {
  const t = useTranslations("profile.personal");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-bg)]"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
          background: "var(--color-bg-3)",
          padding: "4px 10px",
          borderRadius: "5px",
          fontWeight: 600,
          textTransform: "uppercase",
          cursor: "pointer",
          border: 0,
        }}
      >
        {t("editCta")}
      </button>
      <PersonalDataModal
        open={open}
        initial={initial}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
