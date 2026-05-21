"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

interface Props {
  open: boolean;
  /** "enroll" → fresh setup (QR + verify); "disable" → password + code form. */
  mode: "enroll" | "disable";
  onClose: () => void;
  onDone: () => void;
}

interface SetupPayload {
  qrDataUrl: string;
  manualKey: string;
  backupCodes: string[];
}

export function TwoFactorModal({ open, mode, onClose, onDone }: Props) {
  const t = useTranslations("profile.security.twoFa");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"qr" | "verify" | "done">("qr");

  // Trigger setup the moment the modal opens in enroll mode.
  useEffect(() => {
    if (!open || mode !== "enroll" || setup) return;
    setLoadingSetup(true);
    setError(null);
    fetch("/api/profile/2fa/setup", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || tCommon("error"));
        }
        return res.json();
      })
      .then((data) => setSetup(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSetup(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setSetup(null);
      setCode("");
      setPassword("");
      setStep("qr");
      setError(null);
    }
  }, [open]);

  async function verifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || tCommon("error"));
      }
      setStep("done");
      toast.success(t("enrolled"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || tCommon("error"));
      }
      toast.success(t("disabled"));
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VotingModalShell
      open={open}
      onClose={onClose}
      eyebrow={mode === "enroll" ? t("enrollEyebrow") : t("disableEyebrow")}
      title={mode === "enroll" ? t("enrollTitle") : t("disableTitle")}
      subtitle={
        mode === "enroll"
          ? step === "done"
            ? t("enrolledSubtitle")
            : t("enrollSubtitle")
          : t("disableSubtitle")
      }
      accent="moss"
      maxWidth={480}
    >
      <div style={{ padding: "0 24px 22px", overflowY: "auto", flex: 1 }}>
        {error && (
          <div
            role="alert"
            className="mb-4"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {translateError(error, t)}
          </div>
        )}

        {mode === "enroll" && step === "qr" && (
          <>
            {loadingSetup || !setup ? (
              <div
                className="font-mono"
                style={{
                  padding: "32px",
                  textAlign: "center",
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                {tCommon("loading")}
              </div>
            ) : (
              <>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--color-ink-soft)",
                    marginBottom: "14px",
                    lineHeight: 1.5,
                  }}
                >
                  {t("scanInstructions")}
                </p>
                <div className="flex justify-center" style={{ marginBottom: "12px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setup.qrDataUrl}
                    alt="2FA QR code"
                    width={240}
                    height={240}
                    style={{
                      borderRadius: "8px",
                      border:
                        "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                      background: "#fff",
                    }}
                  />
                </div>
                <details style={{ marginBottom: "16px" }}>
                  <summary
                    className="font-mono"
                    style={{
                      fontSize: "11px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.06em",
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    {t("manualKeyToggle")}
                  </summary>
                  <div
                    className="font-mono"
                    style={{
                      marginTop: "8px",
                      padding: "10px 12px",
                      background: "var(--color-bg-3)",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      letterSpacing: "0.05em",
                      wordBreak: "break-all",
                    }}
                  >
                    {setup.manualKey}
                  </div>
                </details>

                <div
                  style={{
                    background: "var(--color-bg-3)",
                    border:
                      "1px solid color-mix(in srgb, var(--color-ochre) 35%, transparent)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color:
                        "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                  >
                    {t("backupTitle")}
                  </div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "var(--color-ink-soft)",
                      marginBottom: "10px",
                      lineHeight: 1.5,
                    }}
                  >
                    {t("backupDesc")}
                  </div>
                  <div
                    className="grid grid-cols-2 gap-1.5 font-mono"
                    style={{
                      fontSize: "13px",
                      letterSpacing: "0.04em",
                      fontWeight: 600,
                    }}
                  >
                    {setup.backupCodes.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "4px 8px",
                          background: "var(--color-card)",
                          borderRadius: "5px",
                          border:
                            "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                          textAlign: "center",
                        }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyBackup(setup.backupCodes, t("backupCopied"))
                    }
                    className="font-mono transition-opacity hover:opacity-70"
                    style={{
                      marginTop: "10px",
                      fontSize: "11px",
                      letterSpacing: "0.05em",
                      color: "var(--color-ink-soft)",
                      background: "transparent",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    {t("backupCopyCta")}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("verify")}
                  className="inline-flex justify-center w-full"
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: "var(--color-ink)",
                    color: "var(--color-bg)",
                    border: "1px solid var(--color-ink)",
                    cursor: "pointer",
                  }}
                >
                  {t("nextCta")}
                </button>
              </>
            )}
          </>
        )}

        {mode === "enroll" && step === "verify" && (
          <form onSubmit={verifyEnrollment}>
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-ink-soft)",
                marginBottom: "14px",
                lineHeight: 1.5,
              }}
            >
              {t("verifyInstructions")}
            </p>
            <VotingField label={t("codeLabel")} htmlFor="totp-enroll">
              <input
                id="totp-enroll"
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="123 456"
                style={{
                  ...votingInputStyle(false),
                  letterSpacing: "0.5em",
                  textAlign: "center",
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                  fontSize: "20px",
                }}
              />
            </VotingField>
            <div
              className="flex justify-end items-center gap-2"
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop:
                  "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
              }}
            >
              <button
                type="button"
                onClick={() => setStep("qr")}
                disabled={submitting}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--color-card)",
                  color: "var(--color-ink-soft)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  cursor: "pointer",
                }}
              >
                {tCommon("back")}
              </button>
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  border: "1px solid var(--color-ink)",
                  cursor:
                    submitting || code.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? tCommon("loading") : t("verifyCta")}
              </button>
            </div>
          </form>
        )}

        {mode === "enroll" && step === "done" && (
          <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <div
              className="grid place-items-center mx-auto"
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "var(--color-good-soft)",
                color: "var(--color-good)",
                marginBottom: "14px",
                fontSize: "26px",
              }}
            >
              ✓
            </div>
            <p style={{ fontSize: "14px", marginBottom: "16px" }}>
              {t("enrolledBody")}
            </p>
            <button
              type="button"
              onClick={onDone}
              className="inline-flex justify-center"
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                background: "var(--color-ink)",
                color: "var(--color-bg)",
                border: "1px solid var(--color-ink)",
                cursor: "pointer",
              }}
            >
              {tCommon("done")}
            </button>
          </div>
        )}

        {mode === "disable" && (
          <form onSubmit={disable2fa}>
            <VotingField
              label={t("disablePasswordLabel")}
              htmlFor="totp-disable-pw"
            >
              <input
                id="totp-disable-pw"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={votingInputStyle(false)}
              />
            </VotingField>
            <VotingField
              label={t("disableCodeLabel")}
              htmlFor="totp-disable-code"
              hint={t("disableCodeHint")}
            >
              <input
                id="totp-disable-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123 456 / XXXXX-XXXXX"
                style={{
                  ...votingInputStyle(false),
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                }}
              />
            </VotingField>
            <div
              className="flex justify-end items-center gap-2"
              style={{
                marginTop: "16px",
                paddingTop: "16px",
                borderTop:
                  "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--color-card)",
                  color: "var(--color-ink-soft)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  cursor: "pointer",
                }}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--color-danger)",
                  color: "var(--color-bg)",
                  border: "1px solid var(--color-danger)",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? tCommon("loading") : t("disableCta")}
              </button>
            </div>
          </form>
        )}
      </div>
    </VotingModalShell>
  );
}

function copyBackup(codes: string[], successMsg: string) {
  const text = codes.join("\n");
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(successMsg))
    .catch(() => {
      // Fallback: show in alert so user can copy manually
      window.prompt("Copy these codes:", text);
    });
}

function translateError(
  raw: string,
  t: ReturnType<typeof useTranslations>,
): string {
  if (raw === "Invalid code") return t("errors.invalidCode");
  if (raw === "Invalid password") return t("errors.invalidPassword");
  if (raw === "Already enrolled") return t("errors.alreadyEnrolled");
  if (raw === "2FA not enabled") return t("errors.notEnabled");
  if (raw === "Start enrollment first") return t("errors.notStarted");
  return raw;
}
