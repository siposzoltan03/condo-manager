import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasMinimumRole } from "@/lib/rbac";
import { getDashboardContext } from "@/lib/dal";
import { redirect } from "next/navigation";
import { FinanceShell } from "@/components/finance/finance-shell";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FinanceInvoicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  if (!hasMinimumRole(ctx.role, "BOARD_MEMBER")) {
    redirect(`/${locale}/finance`);
  }

  const t = await getTranslations({ locale, namespace: "finance" });

  return (
    <FinanceShell
      locale={locale}
      active="invoices"
      titleKey="finance.invoices.title"
      ledeKey="finance.invoices.lede"
    >
      <div
        style={{
          padding: "64px 32px",
          textAlign: "center",
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
        }}
      >
        <div
          className="grid place-items-center mx-auto"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
            color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
            marginBottom: "18px",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M9 14h6M9 18h4" />
          </svg>
        </div>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "24px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            marginBottom: "10px",
          }}
        >
          {t("invoices.emptyTitle")}
        </h2>
        <p
          style={{
            color: "var(--color-ink-soft)",
            fontSize: "14px",
            maxWidth: "44ch",
            margin: "0 auto",
            lineHeight: 1.55,
          }}
        >
          {t("invoices.emptyBody")}
        </p>
        <span
          className="font-mono inline-block"
          style={{
            marginTop: "20px",
            fontSize: "10px",
            padding: "4px 10px",
            borderRadius: "5px",
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            letterSpacing: "0.08em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {t("invoices.comingSoon")}
        </span>
      </div>
    </FinanceShell>
  );
}
