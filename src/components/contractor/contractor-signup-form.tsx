"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AuthField, authInputStyle } from "./auth-field";

type TaxIdState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; normalized: string }
  | { status: "error"; reason: "FORMAT" | "REGION" | "TAKEN" };

/**
 * Contractor signup form. Inline-debounce-validates the adószám against
 * `/api/contractor/auth/check-tax-id` (format-only in Phase 1; Phase 2
 * will swap that endpoint for a real NAV SOAP check). On success the
 * form swaps to a "check your inbox" success state — the verification
 * link is in the email.
 */
export function ContractorSignupForm() {
  const t = useTranslations("contractorAuth");
  const locale = useLocale() as "hu" | "en";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [taxIdState, setTaxIdState] = useState<TaxIdState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Inline tax-id debounce. Re-fires on every change after 350ms idle.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!taxId.trim()) {
      setTaxIdState({ status: "idle" });
      return;
    }
    setTaxIdState({ status: "checking" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/contractor/auth/check-tax-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taxId }),
        });
        const data = (await res.json()) as
          | { ok: true; normalized: string }
          | { ok: false; reason: "FORMAT" | "REGION" | "TAKEN" };
        if (data.ok) {
          setTaxIdState({ status: "ok", normalized: data.normalized });
        } else {
          setTaxIdState({ status: "error", reason: data.reason });
        }
      } catch {
        setTaxIdState({ status: "error", reason: "FORMAT" });
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [taxId]);

  function clearError(field: string) {
    setErrors((p) => {
      if (!p[field]) return p;
      const next = { ...p };
      delete next[field];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = t("errorNameRequired");
    if (orgName.trim().length < 2) errs.orgName = t("errorOrgNameRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = t("errorEmailInvalid");
    if (password.length < 8) errs.password = t("errorPasswordTooShort");
    if (confirm !== password) errs.confirm = t("errorPasswordMismatch");
    if (taxIdState.status !== "ok") {
      if (taxIdState.status === "error") {
        if (taxIdState.reason === "TAKEN") errs.taxId = t("errorTaxIdTaken");
        else if (taxIdState.reason === "REGION")
          errs.taxId = t("errorTaxIdRegion");
        else errs.taxId = t("errorTaxIdFormat");
      } else {
        errs.taxId = t("errorTaxIdFormat");
      }
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/contractor/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          orgName,
          taxId:
            taxIdState.status === "ok" ? taxIdState.normalized : taxId,
          phone: phone || undefined,
          locale,
        }),
      });
      if (!res.ok) {
        setSubmitError(t("errorGeneric"));
        return;
      }
      setSubmitted(email);
    } catch {
      setSubmitError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col">
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            letterSpacing: "0.02em",
          }}
        >
          {t("signupEyebrow")}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "40px",
            fontWeight: 500,
            letterSpacing: "-0.04em",
            lineHeight: "1.04",
            margin: "10px 0 14px",
          }}
        >
          {t("checkInbox")}
        </h1>
        <p
          style={{
            color: "var(--color-ink-soft)",
            fontSize: "15px",
            lineHeight: "1.55",
          }}
        >
          {t("checkInboxBody", { email: submitted })}
        </p>
      </div>
    );
  }

  const taxIdHintNode =
    taxIdState.status === "checking" ? (
      <span style={{ color: "var(--color-muted)" }}>{t("taxIdChecking")}</span>
    ) : taxIdState.status === "ok" ? (
      <span style={{ color: "var(--color-good)" }}>
        ✓ {t("taxIdOk")} — {taxIdState.normalized}
      </span>
    ) : (
      t("fieldTaxIdHint")
    );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <span
        className="font-mono"
        style={{
          fontSize: "12px",
          color: "var(--color-muted)",
          letterSpacing: "0.02em",
        }}
      >
        {t("signupEyebrow")}
      </span>
      <h1
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "40px",
          fontWeight: 500,
          letterSpacing: "-0.04em",
          lineHeight: "1.02",
          margin: "10px 0 8px",
        }}
      >
        {t("signupTitle")}
      </h1>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "15px",
          lineHeight: "1.5",
          margin: "0 0 24px",
        }}
      >
        {t("signupSubtitle")}
      </p>

      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {submitError}
        </div>
      )}

      <AuthField label={t("fieldName")} htmlFor="ca-name" error={errors.name}>
        <input
          id="ca-name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
          }}
          placeholder={t("fieldNamePlaceholder")}
          style={authInputStyle(!!errors.name)}
        />
      </AuthField>

      <AuthField
        label={t("fieldOrgName")}
        htmlFor="ca-org"
        hint={!errors.orgName ? t("fieldOrgNameHint") : undefined}
        error={errors.orgName}
      >
        <input
          id="ca-org"
          type="text"
          required
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value);
            clearError("orgName");
          }}
          placeholder={t("fieldOrgNamePlaceholder")}
          style={authInputStyle(!!errors.orgName)}
        />
      </AuthField>

      <AuthField
        label={t("fieldTaxId")}
        htmlFor="ca-tax"
        error={errors.taxId}
      >
        <input
          id="ca-tax"
          type="text"
          required
          inputMode="numeric"
          value={taxId}
          onChange={(e) => {
            setTaxId(e.target.value);
            clearError("taxId");
          }}
          placeholder={t("fieldTaxIdPlaceholder")}
          style={{
            ...authInputStyle(!!errors.taxId),
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            letterSpacing: "0.04em",
          }}
        />
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            marginTop: "5px",
            letterSpacing: "0.04em",
            color:
              taxIdState.status === "ok"
                ? "var(--color-good)"
                : "var(--color-muted)",
          }}
        >
          {taxIdHintNode}
        </div>
      </AuthField>

      <AuthField label={t("fieldEmail")} htmlFor="ca-email" error={errors.email}>
        <input
          id="ca-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError("email");
          }}
          placeholder={t("fieldEmailPlaceholder")}
          style={authInputStyle(!!errors.email)}
        />
      </AuthField>

      <AuthField
        label={t("fieldPhone")}
        htmlFor="ca-phone"
      >
        <input
          id="ca-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("fieldPhonePlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>

      <AuthField
        label={t("fieldPassword")}
        htmlFor="ca-pw"
        hint={!errors.password ? t("passwordHint") : undefined}
        error={errors.password}
      >
        <input
          id="ca-pw"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
            if (confirm) clearError("confirm");
          }}
          placeholder={t("fieldPasswordPlaceholder")}
          style={authInputStyle(!!errors.password)}
        />
      </AuthField>

      <AuthField
        label={t("fieldConfirmPassword")}
        htmlFor="ca-pw2"
        error={errors.confirm}
      >
        <input
          id="ca-pw2"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            clearError("confirm");
          }}
          placeholder={t("fieldPasswordPlaceholder")}
          style={authInputStyle(!!errors.confirm)}
        />
      </AuthField>

      <div
        className="flex items-start gap-2 text-[13px]"
        style={{ margin: "8px 0 18px", color: "var(--color-ink-soft)" }}
      >
        <input
          type="checkbox"
          defaultChecked
          required
          className="appearance-none cursor-pointer relative shrink-0"
          style={{
            width: "16px",
            height: "16px",
            marginTop: "2px",
            border:
              "1.5px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
            borderRadius: "4px",
            background: "var(--color-bg-3)",
          }}
        />
        <span style={{ fontSize: "12px", lineHeight: 1.45 }}>
          {t("termsAccept")}{" "}
          <a href="#" style={termsLinkStyle}>
            {t("termsLinkText")}
          </a>{" "}
          {t("andText")}{" "}
          <a href="#" style={termsLinkStyle}>
            {t("privacyLinkText")}
          </a>{" "}
          {t("termsAcceptSuffix")}
        </span>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          padding: "14px 22px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <span>{submitting ? "…" : t("submitSignup")}</span>
        {!submitting && <span>→</span>}
      </button>
    </form>
  );
}

const termsLinkStyle: React.CSSProperties = {
  color: "var(--color-ink)",
  fontWeight: 500,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};
