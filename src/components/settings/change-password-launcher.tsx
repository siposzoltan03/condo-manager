"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const ERR_KEY: Record<string, string> = {
  WRONG_CURRENT: "errWrongCurrent",
  SAME_PASSWORD: "errSame",
  NO_PASSWORD: "errNoPassword",
  MISSING_FIELDS: "errMissing",
};

export function ChangePasswordLauncher() {
  const t = useTranslations("profile.security");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setCurrent(""); setNext(""); setConfirm(""); setErr(null);
  }
  function close() {
    setOpen(false); reset();
  }

  async function submit() {
    setErr(null);
    if (!current || !next || !confirm) { setErr(t("changePassword.errMissing")); return; }
    if (next !== confirm) { setErr(t("changePassword.errMismatch")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const code = typeof d.error === "string" ? d.error : "";
        setErr(ERR_KEY[code] ? t(`changePassword.${ERR_KEY[code]}`) : d.error || tc("error"));
        return;
      }
      toast.success(t("changePassword.success"));
      close();
    } finally {
      setBusy(false);
    }
  }

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
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          color: "var(--color-ink)",
          cursor: "pointer",
        }}
      >
        {t("changeCta")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, var(--color-ink) 45%, transparent)" }}
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "var(--color-bg)", border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg text-ink mb-1">{t("changePassword.title")}</h2>
            <p className="text-[13px] text-ink-soft mb-4">{t("changePassword.subtitle")}</p>

            <div className="space-y-3">
              {([
                ["current", current, setCurrent, t("changePassword.currentLabel")],
                ["new", next, setNext, t("changePassword.newLabel")],
                ["confirm", confirm, setConfirm, t("changePassword.confirmLabel")],
              ] as const).map(([key, val, set, label]) => (
                <div key={key}>
                  <label className="block font-mono text-[10.5px] uppercase tracking-wider text-muted mb-1">{label}</label>
                  <input
                    type="password"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    autoComplete={key === "current" ? "current-password" : "new-password"}
                    className="w-full rounded-lg px-3 py-2 text-sm text-ink outline-none"
                    style={{ border: "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)", background: "var(--color-card)" }}
                  />
                </div>
              ))}
            </div>

            {err && <p className="mt-3 text-[13px]" style={{ color: "var(--color-danger)" }}>{err}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)", color: "var(--color-ink-soft)" }}
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
              >
                {t("changePassword.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
