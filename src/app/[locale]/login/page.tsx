"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LoginForm } from "@/components/auth/login-form";
import { LoginLanguageSwitcher } from "@/components/auth/login-language-switcher";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div
      className="login-shell grid min-h-screen"
      style={{
        gridTemplateColumns: "1fr 1.1fr",
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
      }}
    >
      {/* Right panel collapses below 1024px */}
      <style>{`
        @media (max-width: 1024px) {
          .login-shell { grid-template-columns: 1fr !important; }
          .login-shell .login-right { display: none !important; }
          .login-shell .login-left { padding: 24px 28px !important; }
        }
      `}</style>

      <LeftPanel mode={mode} setMode={setMode} />
      <RightPanel />
    </div>
  );
}

function LeftPanel({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const t = useTranslations();

  return (
    <div className="login-left flex flex-col" style={{ padding: "32px 56px" }}>
      {/* Top: brand + flip link */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "20px",
            letterSpacing: "-0.03em",
          }}
        >
          <span
            className="grid place-items-center rounded-lg"
            style={{
              width: "30px",
              height: "30px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              fontWeight: 700,
              fontSize: "15px",
              letterSpacing: "-0.05em",
            }}
          >
            K
          </span>
          {t("brand.name")}
        </Link>
        <div
          className="font-mono"
          style={{ fontSize: "12px", color: "var(--color-muted)" }}
        >
          {mode === "login" ? (
            <>
              {t("auth.noAccountYet")}{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                style={{
                  color: "var(--color-ink)",
                  fontWeight: 600,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                {t("auth.registerCta")}
              </button>
            </>
          ) : (
            <>
              {t("auth.alreadyHaveAccount")}{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                style={{
                  color: "var(--color-ink)",
                  fontWeight: 600,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                {t("auth.loginCta")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Center: form */}
      <div
        className="flex flex-1 flex-col justify-center mx-auto w-full"
        style={{ maxWidth: "420px", padding: "40px 0" }}
      >
        <Suspense>
          <LoginForm mode={mode} setMode={setMode} />
        </Suspense>
      </div>

      {/* Bottom: copyright + footer links + lang switcher */}
      <div
        className="flex items-center justify-between gap-4 flex-wrap font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        <span>{t("footer.copyright")}</span>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-[var(--color-ink)] transition-colors">
            {t("footer.privacy")}
          </a>
          <a href="#" className="hover:text-[var(--color-ink)] transition-colors">
            {t("footer.terms")}
          </a>
          <a href="#" className="hover:text-[var(--color-ink)] transition-colors">
            {t("footer.help")}
          </a>
          <LoginLanguageSwitcher />
        </div>
      </div>
    </div>
  );
}

function RightPanel() {
  const t = useTranslations();

  return (
    <div
      className="login-right relative flex flex-col justify-between overflow-hidden"
      style={{
        background: "var(--color-moss)",
        color: "#f5f2e6",
        padding: "36px",
      }}
    >
      {/* Grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(color-mix(in srgb, #f5f2e6 6%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, #f5f2e6 6%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          backgroundPosition: "-1px -1px",
        }}
      />

      {/* Top: eyebrow + version chip */}
      <div className="relative z-10 flex items-start justify-between gap-6">
        <span
          className="font-mono"
          style={{
            fontSize: "16px",
            letterSpacing: "0.04em",
            color: "color-mix(in srgb, #f5f2e6 70%, transparent)",
          }}
        >
          {t("brand.monoEyebrow")}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "color-mix(in srgb, #f5f2e6 75%, transparent)",
            padding: "5px 10px",
            borderRadius: "6px",
            border: "1px solid color-mix(in srgb, #f5f2e6 18%, transparent)",
          }}
        >
          {t("brand.version")}
        </span>
      </div>

      {/* Center: K monogram + tile ornaments */}
      <div
        className="relative z-10 flex flex-1 items-center justify-center"
        style={{ padding: "20px 0" }}
      >
        <span
          aria-hidden
          className="absolute"
          style={{
            top: "20%",
            left: "8%",
            width: "56px",
            height: "56px",
            borderRadius: "10px",
            background: "color-mix(in srgb, #f5f2e6 10%, transparent)",
            border: "1px solid color-mix(in srgb, #f5f2e6 14%, transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute"
          style={{
            top: "12%",
            right: "14%",
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "color-mix(in srgb, var(--color-ochre) 55%, transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute"
          style={{
            bottom: "22%",
            left: "12%",
            width: "72px",
            height: "32px",
            borderRadius: "10px",
            background: "color-mix(in srgb, #f5f2e6 10%, transparent)",
            border: "1px solid color-mix(in srgb, #f5f2e6 14%, transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute"
          style={{
            bottom: "14%",
            right: "18%",
            width: "48px",
            height: "48px",
            borderRadius: "10px",
            background: "color-mix(in srgb, #f5f2e6 10%, transparent)",
            border: "1px solid color-mix(in srgb, #f5f2e6 14%, transparent)",
          }}
        />

        <div
          className="relative select-none"
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 500,
            letterSpacing: "-0.08em",
            fontSize: "clamp(280px, 38vw, 520px)",
            lineHeight: "0.82",
            color: "#f5f2e6",
          }}
        >
          K
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: "16px",
              height: "16px",
              background: "var(--color-ochre)",
              right: "-4px",
              bottom: "24px",
            }}
          />
        </div>
      </div>

      {/* Bottom: tagline + meta */}
      <div className="relative z-10 flex items-end justify-between gap-5">
        <p
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: "1.15",
            maxWidth: "22ch",
          }}
          dangerouslySetInnerHTML={{
            __html: t
              .raw("brand.tagline")
              .replace(
                /<em>(.*?)<\/em>/g,
                `<em style="font-style:italic;font-weight:400;color:var(--color-ochre)">$1</em>`,
              ),
          }}
        />
        <div
          className="font-mono text-right"
          style={{
            fontSize: "11px",
            letterSpacing: "0.05em",
            lineHeight: "1.6",
            color: "color-mix(in srgb, #f5f2e6 65%, transparent)",
          }}
        >
          {t("brand.metaCity")}
          <br />
          {t("brand.metaCommand")}
        </div>
      </div>
    </div>
  );
}
