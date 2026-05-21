"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

type Mode = "login" | "signup";

export function LoginForm({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale() as "hu" | "en";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [houseName, setHouseName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** When true, the form swaps to "enter your 2FA code" step. */
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  // Show success banner after email verification ("/login?verified=1").
  const verified = searchParams.get("verified") === "1";

  // Clear a single field's error as the user starts correcting it.
  function clearFieldError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateSignup(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = t("auth.errorNameRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = t("auth.errorEmailInvalid");
    if (houseName.trim().length < 2)
      errs.houseName = t("auth.errorBuildingRequired");
    if (password.length < 10) errs.password = t("auth.errorPasswordTooShort");
    if (confirmPassword !== password)
      errs.confirmPassword = t("auth.errorPasswordMismatch");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      const errs = validateSignup();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setErrors({});

      setLoading(true);
      try {
        const res = await fetch(`/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            buildingName: houseName,
            locale,
          }),
        });
        if (res.status === 409) {
          // Server says email is taken — surface both as a banner and as an
          // email-field error so the highlight is consistent.
          setError(t("auth.emailTaken"));
          setErrors({ email: t("auth.emailTaken") });
          return;
        }
        if (res.status === 400) {
          // Server-side validation rejected — try to map field-specific
          // errors if the API returned them, else show a generic message.
          try {
            const body = (await res.json()) as { fields?: Record<string, string> };
            if (body.fields) {
              setErrors(body.fields);
              return;
            }
          } catch {
            // fall through
          }
          setError(tCommon("error"));
          return;
        }
        if (!res.ok) {
          setError(tCommon("error"));
          return;
        }
        router.push(
          `/${locale}/verify-email/pending?email=${encodeURIComponent(email)}`,
        );
      } catch {
        setError(tCommon("error"));
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      // Step 1 — if we're not already collecting a TOTP, pre-check whether the
      // account has 2FA enrolled. The pre-check validates the password too, so
      // bad credentials get rejected here without ever calling NextAuth.
      if (!twoFactorRequired) {
        const checkRes = await fetch("/api/auth/check-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const checkData = (await checkRes.json().catch(() => null)) as
          | { ok: boolean; twoFactorRequired: boolean }
          | null;

        if (!checkRes.ok || !checkData) {
          setError(t("auth.invalidCredentials"));
          return;
        }
        if (!checkData.ok) {
          setError(t("auth.invalidCredentials"));
          return;
        }
        if (checkData.twoFactorRequired) {
          // Swap to TOTP step; user re-submits with the code.
          setTwoFactorRequired(true);
          setError("");
          return;
        }
        // Otherwise fall through to the no-2FA signIn below.
      }

      // Step 2 — actual NextAuth signIn (with totp if collected).
      const result = await signIn("credentials", {
        email,
        password,
        ...(twoFactorRequired && totp ? { totp } : {}),
        redirect: false,
      });

      if (result?.error) {
        // After the pre-check passed, the only realistic failure is a bad TOTP.
        if (twoFactorRequired) {
          setError(t("auth.invalidTwoFactor"));
        } else {
          setError(t("auth.invalidCredentials"));
        }
      } else {
        const raw = searchParams.get("callbackUrl") ?? "/";
        const safeUrl =
          raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://")
            ? raw
            : "/";
        router.push(safeUrl);
        router.refresh();
      }
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email || resendStatus !== "idle") return;
    setResendStatus("sending");
    try {
      await fetch(`/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Pill tabs */}
      <div
        className="inline-flex p-[3px] rounded-[10px] self-start mb-8"
        style={{
          background: "var(--color-bg-3)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        }}
      >
        <TabButton active={mode === "login"} onClick={() => setMode("login")}>
          {t("auth.loginTab")}
        </TabButton>
        <TabButton active={mode === "signup"} onClick={() => setMode("signup")}>
          {t("auth.signupTab")}
        </TabButton>
      </div>

      {/* Eyebrow */}
      <span
        className="font-mono"
        style={{
          fontSize: "12px",
          color: "var(--color-muted)",
          letterSpacing: "0.02em",
        }}
      >
        {mode === "login" ? t("auth.loginEyebrow") : t("auth.signupEyebrow")}
      </span>

      {/* Headline */}
      <h1
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "52px",
          fontWeight: 500,
          letterSpacing: "-0.045em",
          lineHeight: "0.95",
          margin: "10px 0 8px",
        }}
      >
        {mode === "login" ? (
          <>
            {t("auth.welcomeBackHeading")}{" "}
            <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
              {t("auth.welcomeBackHeadingSoft")}
            </span>
          </>
        ) : (
          <>
            {t("auth.createHouseHeading")}{" "}
            <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
              {t("auth.createHouseHeadingSoft")}
            </span>
          </>
        )}
      </h1>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "15px",
          margin: "0 0 28px",
        }}
      >
        {mode === "login" ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
      </p>

      {/* Verified banner — shown after /verify-email/[token] redirected here */}
      {verified && mode === "login" && !error && (
        <div
          role="status"
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, var(--color-good) 12%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-good) 35%, transparent)",
            color: "var(--color-good)",
          }}
        >
          {t("auth.verifiedBanner")}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      {/* OAuth — visual only, "Hamarosan" badge */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <OAuthButton provider="google" />
        <OAuthButton provider="facebook" />
      </div>

      <Divider>{t("auth.orWithEmail")}</Divider>

      {/* Name (signup only) */}
      {mode === "signup" && (
        <Field label={t("auth.fieldName")} htmlFor="name" error={errors.name}>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            aria-invalid={!!errors.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
            placeholder={t("auth.fieldNamePlaceholder")}
            style={inputStyle(!!errors.name)}
          />
        </Field>
      )}

      {/* Email */}
      <Field label={t("auth.fieldEmail")} htmlFor="email" error={errors.email}>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={!!errors.email}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError("email");
          }}
          placeholder={t("auth.fieldEmailPlaceholder")}
          style={inputStyle(!!errors.email)}
        />
      </Field>

      {/* House name (signup only) */}
      {mode === "signup" && (
        <Field
          label={t("auth.fieldHouseName")}
          htmlFor="house"
          hint={t("auth.fieldHouseHelp")}
          error={errors.houseName}
        >
          <input
            id="house"
            type="text"
            aria-invalid={!!errors.houseName}
            value={houseName}
            onChange={(e) => {
              setHouseName(e.target.value);
              clearFieldError("houseName");
            }}
            placeholder={t("auth.fieldHouseNamePlaceholder")}
            style={inputStyle(!!errors.houseName)}
          />
        </Field>
      )}

      {/* Password with show/hide */}
      <Field
        label={t("auth.fieldPassword")}
        htmlFor="password"
        hint={
          mode === "signup" && !errors.password
            ? t("auth.passwordHint")
            : undefined
        }
        error={errors.password}
      >
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={!!errors.password}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
              // Recheck mismatch live if user already typed a confirmation.
              if (confirmPassword) clearFieldError("confirmPassword");
            }}
            placeholder={t("auth.fieldPasswordPlaceholder")}
            style={{ ...inputStyle(!!errors.password), paddingRight: "44px" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            className="absolute grid place-items-center transition-colors"
            style={{
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "32px",
              height: "32px",
              borderRadius: "7px",
              color: "var(--color-muted)",
            }}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        </div>
      </Field>

      {/* Two-factor code (login only, after first attempt signals 2FA needed) */}
      {mode === "login" && twoFactorRequired && (
        <Field
          label={t("auth.fieldTwoFactor")}
          htmlFor="totp"
          error={undefined}
        >
          <input
            id="totp"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            required
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
            placeholder="123 456 / XXXXX-XXXXX"
            style={{
              ...inputStyle(false),
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              letterSpacing: "0.1em",
            }}
            autoFocus
          />
          <small
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              marginTop: "5px",
              display: "block",
            }}
          >
            {t("auth.twoFactorHint")}
          </small>
        </Field>
      )}

      {/* Confirm password (signup only) */}
      {mode === "signup" && (
        <Field
          label={t("auth.fieldConfirmPassword")}
          htmlFor="confirm-password"
          error={errors.confirmPassword}
        >
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearFieldError("confirmPassword");
            }}
            placeholder={t("auth.fieldConfirmPasswordPlaceholder")}
            style={inputStyle(!!errors.confirmPassword)}
          />
        </Field>
      )}

      {/* Login row: stay signed in + forgot */}
      {mode === "login" && (
        <div
          className="flex items-center justify-between text-[13px]"
          style={{ margin: "6px 0 22px" }}
        >
          <label
            className="inline-flex items-center gap-2 cursor-pointer"
            style={{ color: "var(--color-ink-soft)" }}
          >
            <input
              type="checkbox"
              defaultChecked
              className="appearance-none cursor-pointer relative"
              style={{
                width: "16px",
                height: "16px",
                border: "1.5px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
                borderRadius: "4px",
                background: "var(--color-bg-3)",
              }}
            />
            {t("auth.staySignedIn")}
          </label>
          <Link
            href="/forgot-password"
            style={{
              color: "var(--color-ink)",
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {t("auth.forgotShort")}
          </Link>
        </div>
      )}

      {/* Signup terms row */}
      {mode === "signup" && (
        <div
          className="flex items-start gap-2 text-[13px]"
          style={{ margin: "6px 0 22px", color: "var(--color-ink-soft)" }}
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
              border: "1.5px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
              borderRadius: "4px",
              background: "var(--color-bg-3)",
            }}
          />
          <span style={{ fontSize: "12px", lineHeight: 1.45 }}>
            {t("auth.termsAccept")}{" "}
            <a href="#" style={termsLinkStyle}>
              {t("auth.termsLinkText")}
            </a>{" "}
            {t("auth.andText")}{" "}
            <a href="#" style={termsLinkStyle}>
              {t("auth.privacyLinkText")}
            </a>{" "}
            {t("auth.termsAcceptSuffix")}
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
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
        {loading ? (
          <Spinner />
        ) : (
          <>
            <span>{mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup")}</span>
            <span>→</span>
          </>
        )}
      </button>

      {/* Footer note */}
      {mode === "login" ? (
        <>
          {/* Resend-verification escape hatch — always visible in login mode so
              a user who can't sign in (because they didn't verify) has a clear
              path. The endpoint always returns 200 to avoid email enumeration. */}
          <p
            className="text-center mt-[16px]"
            style={{ fontSize: "12.5px", color: "var(--color-ink-soft)" }}
          >
            {t("auth.emailNotVerified")}{" "}
            {resendStatus === "sent" ? (
              <span style={{ color: "var(--color-good)", fontWeight: 500 }}>
                {t("verifyEmail.resentOk")}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={!email || resendStatus !== "idle"}
                style={{
                  ...termsLinkStyle,
                  cursor: email && resendStatus === "idle" ? "pointer" : "not-allowed",
                  opacity: email && resendStatus === "idle" ? 1 : 0.5,
                }}
              >
                {t("auth.resendVerification")}
              </button>
            )}
          </p>
          <p
            className="font-mono text-center mt-[22px]"
            style={{
              fontSize: "11px",
              letterSpacing: "0.04em",
              color: "var(--color-muted)",
            }}
          >
            {t("auth.ssoFooter")}{" "}
            <a
              href="#"
              className="font-sans"
              style={{
                ...termsLinkStyle,
                fontSize: "13px",
                letterSpacing: 0,
              }}
            >
              {t("auth.ssoLink")}
            </a>{" "}
            {t("auth.ssoFooterSuffix")}
          </p>
        </>
      ) : (
        <p
          className="text-center mt-[22px]"
          style={{ fontSize: "13px", color: "var(--color-ink-soft)" }}
        >
          {t("auth.signupFooter")}{" "}
          <button
            type="button"
            onClick={() => setMode("login")}
            style={termsLinkStyle}
          >
            {t("auth.signupFooterCta")}
          </button>
          .
        </p>
      )}
    </form>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 18px",
        borderRadius: "7px",
        fontSize: "13px",
        fontWeight: 600,
        background: active ? "var(--color-ink)" : "transparent",
        color: active ? "var(--color-bg)" : "var(--color-ink-soft)",
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className="mb-3.5">
      <label
        htmlFor={htmlFor}
        className="block font-mono"
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: error ? "var(--color-danger)" : "var(--color-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      <div className="relative">{children}</div>
      {error ? (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5"
          style={{
            fontSize: "12px",
            color: "var(--color-danger)",
            marginTop: "6px",
            fontWeight: 500,
          }}
        >
          <ErrorIcon />
          {error}
        </div>
      ) : hint ? (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            marginTop: "5px",
            letterSpacing: "0.04em",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 font-mono"
      style={{
        margin: "20px 0",
        color: "var(--color-muted)",
        fontSize: "11px",
        letterSpacing: "0.1em",
      }}
    >
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: "1px",
          background: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        }}
      />
      {children}
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: "1px",
          background: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        }}
      />
    </div>
  );
}

function OAuthButton({ provider }: { provider: "google" | "facebook" }) {
  const t = useTranslations();
  const label = provider === "google" ? t("auth.oauthGoogle") : t("auth.oauthFacebook");

  return (
    <button
      type="button"
      disabled
      title={t("auth.oauthComingSoon")}
      className="relative inline-flex items-center justify-center gap-2.5 transition-colors"
      style={{
        padding: "11px 14px",
        background: "var(--color-bg-3)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "10px",
        fontWeight: 500,
        fontSize: "13px",
        cursor: "not-allowed",
        opacity: 0.7,
      }}
    >
      {provider === "google" ? <GoogleIcon /> : <FacebookIcon />}
      {label}
      <span
        className="absolute font-mono"
        style={{
          top: "-7px",
          right: "8px",
          fontSize: "9px",
          letterSpacing: "0.06em",
          padding: "2px 6px",
          borderRadius: "4px",
          background: "var(--color-ochre)",
          color: "var(--color-ink)",
          fontWeight: 700,
        }}
      >
        {t("auth.oauthComingSoon").toUpperCase()}
      </span>
    </button>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2" aria-hidden>
      <path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5 3.66 9.15 8.44 9.93v-7.03H7.9v-2.9h2.54V9.8c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.9h-2.33v7.02A10 10 0 0 0 22 12.07z" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a17.83 17.83 0 0 1 4.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a17.84 17.84 0 0 1-2.16 3.19" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 14px",
    fontSize: "14px",
    color: "var(--color-ink)",
    background: hasError
      ? "color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-3))"
      : "var(--color-bg-3)",
    border: hasError
      ? "1px solid var(--color-danger)"
      : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    borderRadius: "10px",
    outline: "none",
    transition: "border-color 0.15s, background 0.15s",
  };
}

const termsLinkStyle: React.CSSProperties = {
  color: "var(--color-ink)",
  fontWeight: 500,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};
