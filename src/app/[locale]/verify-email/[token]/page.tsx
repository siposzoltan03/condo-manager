import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { consumeVerificationToken } from "@/lib/email-verification";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export default async function VerifyEmailTokenPage({ params }: Props) {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "verifyEmail" });

  const result = await consumeVerificationToken(token);

  // On success — redirect straight to login with a success flag so the page
  // can show "Email verified — sign in now" copy. The user types their
  // password to sign in (already chosen at signup).
  if (result) {
    redirect(`/${locale}/login?verified=1`);
  }

  // Failure path — invalid or expired token. Render a small page with a
  // resend option (resend uses the email address, which we don't have here,
  // so we send the user back to /verify-email/pending with no email; the
  // form there asks for the email and calls /api/auth/resend-verification).
  return (
    <div
      className="grid min-h-screen place-items-center px-6"
      style={{
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
      }}
    >
      <div
        className="max-w-md w-full"
        style={{ padding: "32px", borderRadius: "14px", background: "var(--color-card)", border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            margin: "0 0 12px",
          }}
        >
          {t("invalidTitle")}
        </h1>
        <p style={{ color: "var(--color-ink-soft)", fontSize: "14px", margin: "0 0 24px" }}>
          {t("invalidBody")}
        </p>
        <Link
          href={`/${locale}/verify-email/pending`}
          className="inline-flex items-center gap-2"
          style={{
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {t("requestNewLink")} →
        </Link>
      </div>
    </div>
  );
}
