import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailPendingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { email } = await searchParams;
  const t = await getTranslations({ locale, namespace: "verifyEmail" });
  const tBrand = await getTranslations({ locale, namespace: "brand" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });

  return (
    <div
      className="grid min-h-screen"
      style={{
        gridTemplateRows: "auto 1fr auto",
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
      }}
    >
      {/* Top: brand mark */}
      <header
        className="flex items-center justify-between"
        style={{ padding: "32px 56px" }}
      >
        <Link
          href={`/${locale}/login`}
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
          {tBrand("name")}
        </Link>
      </header>

      {/* Center: confirmation card */}
      <main className="grid place-items-center px-6">
        <div
          className="w-full"
          style={{
            maxWidth: "520px",
            padding: "44px 44px 36px",
            borderRadius: "16px",
            background: "var(--color-card)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            boxShadow:
              "0 24px 60px -28px color-mix(in srgb, var(--color-ink) 16%, transparent), 0 8px 18px -8px color-mix(in srgb, var(--color-ink) 8%, transparent)",
          }}
        >
          {/* Hero send icon */}
          <div className="flex justify-center" style={{ marginBottom: "20px" }}>
            <div
              className="grid place-items-center"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--color-moss) 14%, var(--color-card))",
                color: "var(--color-moss)",
                border: "1px solid color-mix(in srgb, var(--color-moss) 25%, transparent)",
              }}
            >
              <PaperPlaneIcon />
            </div>
          </div>

          {/* Eyebrow + headline */}
          <div className="text-center">
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {t("eyebrow")}
            </span>
            <h1
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "36px",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                margin: "10px 0 14px",
              }}
            >
              {t("pendingHeadline")}
            </h1>
            <p
              style={{
                color: "var(--color-ink-soft)",
                fontSize: "15px",
                lineHeight: 1.55,
                margin: 0,
                maxWidth: "44ch",
                marginInline: "auto",
              }}
            >
              {t("pendingSubhead")}
            </p>
          </div>

          {/* Prominent email display */}
          <div
            className="text-center"
            style={{
              margin: "28px 0 24px",
              padding: "16px 18px",
              borderRadius: "10px",
              background: "var(--color-bg-3)",
              border: "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              {t("pendingSentTo")}
            </div>
            <div
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "17px",
                fontWeight: 500,
                wordBreak: "break-all",
              }}
            >
              {email ?? t("pendingNoEmailFallback")}
            </div>
          </div>

          {/* Numbered checklist */}
          <div style={{ marginBottom: "28px" }}>
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              {t("pendingChecklistTitle")}
            </div>
            <ChecklistItem n={1}>{t("pendingChecklist1")}</ChecklistItem>
            <ChecklistItem n={2}>{t("pendingChecklist2")}</ChecklistItem>
            <ChecklistItem n={3} last>
              {t("pendingChecklist3")}
            </ChecklistItem>
          </div>

          {/* Resend section, separated by a labeled divider */}
          <div
            className="flex items-center gap-3 font-mono"
            style={{
              margin: "24px 0 16px",
              color: "var(--color-muted)",
              fontSize: "10px",
              letterSpacing: "0.1em",
            }}
          >
            <span
              aria-hidden
              className="flex-1"
              style={{
                height: "1px",
                background: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            />
            {t("pendingDivider")}
            <span
              aria-hidden
              className="flex-1"
              style={{
                height: "1px",
                background: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            />
          </div>

          <ResendVerificationForm initialEmail={email ?? ""} locale={locale} />

          <p
            className="font-mono text-center"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.08em",
              margin: "24px 0 0",
            }}
          >
            {t("expiryNote")}
          </p>
        </div>
      </main>

      {/* Bottom strip */}
      <footer
        className="font-mono text-center"
        style={{
          padding: "20px 24px 28px",
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {tFooter("copyright")}
      </footer>
    </div>
  );
}

function ChecklistItem({
  n,
  children,
  last,
}: {
  n: number;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3"
      style={{
        padding: "10px 0",
        borderBottom: last
          ? "none"
          : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <span
        className="grid place-items-center flex-shrink-0 font-mono"
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
          color: "color-mix(in srgb, var(--color-ochre) 90%, var(--color-ink))",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0",
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: "13.5px",
          color: "var(--color-ink-soft)",
          lineHeight: 1.5,
          paddingTop: "2px",
        }}
      >
        {children}
      </span>
    </div>
  );
}

function PaperPlaneIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
