"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ResendVerificationForm({
  initialEmail,
  locale,
}: {
  initialEmail: string;
  locale: string;
}) {
  const t = useTranslations("verifyEmail");
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    try {
      // API routes live at /api/* (no locale prefix); locale only prefixes pages
      void locale;
      await fetch(`/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // The endpoint always returns 200 to prevent enumeration. We show the
      // success state regardless; the actual email send is best-effort.
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label
        htmlFor="resend-email"
        className="block font-mono"
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-muted)",
          marginBottom: "0",
        }}
      >
        {t("emailLabel")}
      </label>
      <input
        id="resend-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="anna@tarsashaz.hu"
        disabled={status === "sending" || status === "sent"}
        style={{
          width: "100%",
          padding: "12px 14px",
          fontSize: "14px",
          color: "var(--color-ink)",
          background: "var(--color-bg-3)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "10px",
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={status === "sending" || status === "sent"}
        className="inline-flex items-center justify-center transition-opacity disabled:opacity-60"
        style={{
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          padding: "12px 18px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        {status === "sent" ? t("resentOk") : t("resendCta")}
      </button>
      {status === "error" && (
        <p style={{ color: "var(--color-danger)", fontSize: "13px", margin: 0 }}>
          {t("resendError")}
        </p>
      )}
    </form>
  );
}
