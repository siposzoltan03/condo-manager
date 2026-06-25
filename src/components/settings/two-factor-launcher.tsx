"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TwoFactorModal } from "./two-factor-modal";

interface Props {
  enrolled: boolean;
}

export function TwoFactorLauncher({ enrolled }: Props) {
  const t = useTranslations("profile.security.twoFa");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="transition-opacity hover:opacity-80"
        style={{
          fontSize: "12px",
          fontWeight: 600,
          padding: "6px 12px",
          borderRadius: "8px",
          background: enrolled ? "var(--color-card)" : "var(--color-ink)",
          color: enrolled ? "var(--color-ink)" : "var(--color-bg)",
          border: enrolled
            ? "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)"
            : "1px solid var(--color-ink)",
          cursor: "pointer",
        }}
      >
        {enrolled ? t("disableCta") : t("enableCta")}
      </button>

      <TwoFactorModal
        open={open}
        mode={enrolled ? "disable" : "enroll"}
        onClose={() => setOpen(false)}
        onDone={() => setOpen(false)}
      />
    </>
  );
}
