"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AuthField, authInputStyle } from "./auth-field";

/**
 * Username/password sign-in for the contractor tree. Posts to NextAuth
 * with `userType: "contractor"` so the authorize callback queries
 * `ContractorUser` instead of `User`. There's no 2FA / SSO here yet —
 * keeping the surface minimal until the marketplace ships.
 */
export function ContractorLoginForm() {
  const t = useTranslations("contractorAuth");
  const router = useRouter();
  const search = useSearchParams();
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verifiedFlag = search.get("verified");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        userType: "contractor",
        redirect: false,
      });
      if (res?.error) {
        setError(t("invalidCredentials"));
        return;
      }
      // Ask the server where the contractor should land — keeps the
      // PENDING_VERIFICATION → onboarding gate in one place instead of
      // sniffing client-side from a stale session cookie.
      const dest = await fetch(
        `/api/contractor/post-login?locale=${encodeURIComponent(locale)}`,
      ).then((r) => (r.ok ? (r.json() as Promise<{ path: string }>) : null));
      router.push(dest?.path ?? `/${locale}/contractor/marketplace`);
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

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
        {t("loginEyebrow")}
      </span>
      <h1
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "44px",
          fontWeight: 500,
          letterSpacing: "-0.04em",
          lineHeight: "1.02",
          margin: "10px 0 8px",
        }}
      >
        {t("loginTitle")}
      </h1>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "15px",
          margin: "0 0 24px",
        }}
      >
        {t("loginSubtitle")}
      </p>

      {verifiedFlag === "ok" && !error && (
        <Banner kind="success">{t("verifiedOk")}</Banner>
      )}
      {verifiedFlag &&
        verifiedFlag !== "ok" &&
        verifiedFlag !== "rate-limited" && (
          <Banner kind="error">{t("verifiedFailed")}</Banner>
        )}
      {error && <Banner kind="error">{error}</Banner>}

      <AuthField
        label={t("fieldEmail")}
        htmlFor="email"
      >
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("fieldEmailPlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>

      <AuthField label={t("fieldPassword")} htmlFor="password">
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("fieldPasswordPlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 mt-3"
        style={{
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          padding: "14px 22px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <span>{loading ? "…" : t("submitLogin")}</span>
        {!loading && <span>→</span>}
      </button>
    </form>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  const tone = kind === "success" ? "var(--color-good)" : "var(--color-danger)";
  return (
    <div
      role={kind === "success" ? "status" : "alert"}
      className="mb-4 rounded-lg border px-4 py-3 text-sm"
      style={{
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${tone} 32%, transparent)`,
        color: tone,
      }}
    >
      {children}
    </div>
  );
}
