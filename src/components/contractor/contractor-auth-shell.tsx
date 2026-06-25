"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LoginLanguageSwitcher } from "@/components/auth/login-language-switcher";

/**
 * Two-pane shell shared by `/contractor/login` and `/contractor/signup`.
 * Same Tiles palette as the condo login but with an ochre right panel
 * (the contractor accent) so a stale tab can't be mistaken for the
 * condo login at a glance.
 */
export function ContractorAuthShell({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: "login" | "signup";
}) {
  const t = useTranslations("contractorAuth");
  const tFooter = useTranslations("footer");

  return (
    <div
      className="contractor-auth-shell grid min-h-screen"
      style={{
        gridTemplateColumns: "1fr 1.1fr",
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .contractor-auth-shell { grid-template-columns: 1fr !important; }
          .contractor-auth-shell .ca-right { display: none !important; }
          .contractor-auth-shell .ca-left { padding: 24px 28px !important; }
        }
      `}</style>

      <div className="ca-left flex flex-col" style={{ padding: "32px 56px" }}>
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
            Közös
          </Link>
          <div
            className="font-mono"
            style={{ fontSize: "12px", color: "var(--color-muted)" }}
          >
            {mode === "login" ? (
              <>
                {t("switchToSignup")}{" "}
                <Link
                  href="/contractor/signup"
                  style={{
                    color: "var(--color-ink)",
                    fontWeight: 600,
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  {t("switchToSignupCta")}
                </Link>
              </>
            ) : (
              <>
                {t("switchToLogin")}{" "}
                <Link
                  href="/contractor/login"
                  style={{
                    color: "var(--color-ink)",
                    fontWeight: 600,
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  {t("switchToLoginCta")}
                </Link>
              </>
            )}
          </div>
        </div>

        <div
          className="flex flex-1 flex-col justify-center mx-auto w-full"
          style={{ maxWidth: "440px", padding: "40px 0" }}
        >
          {children}
        </div>

        <div
          className="flex items-center justify-between gap-4 flex-wrap font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          <Link
            href="/login"
            className="hover:text-[var(--color-ink)] transition-colors"
          >
            ← {t("backToCondo")}
          </Link>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[var(--color-ink)] transition-colors">
              {tFooter("privacy")}
            </a>
            <a href="#" className="hover:text-[var(--color-ink)] transition-colors">
              {tFooter("terms")}
            </a>
            <LoginLanguageSwitcher />
          </div>
        </div>
      </div>

      <div
        className="ca-right relative flex flex-col justify-between overflow-hidden"
        style={{
          background: "var(--color-ochre)",
          color: "var(--color-ink)",
          padding: "36px",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(color-mix(in srgb, var(--color-ink) 6%, transparent) 1px, transparent 1px),
              linear-gradient(90deg, color-mix(in srgb, var(--color-ink) 6%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            backgroundPosition: "-1px -1px",
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <span
            className="font-mono"
            style={{
              fontSize: "16px",
              letterSpacing: "0.04em",
              color: "color-mix(in srgb, var(--color-ink) 75%, transparent)",
            }}
          >
            {t("brandEyebrow")}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              padding: "5px 10px",
              borderRadius: "6px",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 18%, transparent)",
              background: "color-mix(in srgb, var(--color-bg) 30%, transparent)",
            }}
          >
            Beta
          </span>
        </div>

        <div className="relative z-10" style={{ padding: "20px 0" }}>
          <span
            aria-hidden
            className="absolute"
            style={{
              top: "10%",
              right: "12%",
              width: "56px",
              height: "56px",
              borderRadius: "10px",
              background: "var(--color-moss)",
              opacity: 0.85,
            }}
          />
          <span
            aria-hidden
            className="absolute"
            style={{
              top: "30%",
              left: "12%",
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "var(--color-ink)",
              opacity: 0.12,
            }}
          />
          <span
            aria-hidden
            className="absolute"
            style={{
              bottom: "30%",
              right: "8%",
              width: "72px",
              height: "32px",
              borderRadius: "10px",
              background: "var(--color-bg)",
              opacity: 0.7,
            }}
          />

          <p
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "44px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: "1.05",
              maxWidth: "14ch",
            }}
          >
            Munka,{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: "var(--color-moss)",
              }}
            >
              ami téged
            </em>{" "}
            keres.
          </p>
          <p
            className="font-mono mt-6"
            style={{
              fontSize: "13px",
              maxWidth: "32ch",
              color: "color-mix(in srgb, var(--color-ink) 70%, transparent)",
              lineHeight: "1.55",
              letterSpacing: "0.01em",
            }}
          >
            Felfegyverzett társasházak hirdetik a karbantartási munkáikat. Te
            csak licitálsz — a piactér megtalálja a hozzád illő ajánlatokat.
          </p>
        </div>

        <div
          className="relative z-10 font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: "color-mix(in srgb, var(--color-ink) 65%, transparent)",
          }}
        >
          közös · contractor v 0.1
        </div>
      </div>
    </div>
  );
}
