import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasMinimumRole } from "@/lib/rbac";
import { getDashboardContext } from "@/lib/dal";
import { getFinanceBudget } from "@/lib/finance-dal";
import { redirect } from "next/navigation";
import { FinanceShell } from "@/components/finance/finance-shell";
import { FinanceBudgetPanel } from "@/components/finance/finance-budget-panel";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FinanceBudgetPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  if (!hasMinimumRole(ctx.role, "BOARD_MEMBER")) {
    redirect(`/${locale}/finance`);
  }

  const data = await getFinanceBudget();
  const t = await getTranslations({ locale, namespace: "finance" });

  return (
    <FinanceShell
      locale={locale}
      active="budget"
      titleKey="finance.budget.title"
      titleSuffix={`· ${data.year}`}
      ledeKey="finance.budget.lede"
    >
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
        }}
      >
        <div
          className="flex justify-between items-end"
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.02em" }}>
              {t("budget.panelTitle", { year: data.year.toString() })}
            </h3>
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.05em",
                marginTop: "2px",
              }}
            >
              {t("budget.panelSub", { count: data.rows.length.toString() })}
            </div>
          </div>
        </div>

        <FinanceBudgetPanel
          locale={locale}
          rows={data.rows}
          plannedTotal={data.plannedTotal}
          actualTotal={data.actualTotal}
        />
      </div>
    </FinanceShell>
  );
}
