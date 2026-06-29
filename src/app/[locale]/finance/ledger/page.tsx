import { setRequestLocale, getTranslations } from "next-intl/server";
import { allows } from "@/lib/authz";
import { getDashboardContext } from "@/lib/dal";
import { getFinanceLedger } from "@/lib/finance-dal";
import { redirect } from "next/navigation";
import {
  FinanceShell,
  FinanceButton,
} from "@/components/finance/finance-shell";
import { FinanceLedgerTableTiles } from "@/components/finance/finance-ledger-table-tiles";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; account?: string }>;
};

const PAGE_SIZE = 30;

export default async function FinanceLedgerPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageStr, account } = await searchParams;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  if (!allows(ctx, "view.building.finance")) {
    redirect(`/${locale}/finance`);
  }

  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const data = await getFinanceLedger(page, PAGE_SIZE, account);
  const t = await getTranslations({ locale, namespace: "finance" });

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <FinanceShell
      locale={locale}
      active="ledger"
      counts={{ ledger: data.total }}
      ledeKey="finance.ledger.lede"
      titleKey="finance.ledger.title"
      headerActions={
        <>
          <FinanceButton variant="ghost">{t("headerActions.bankCsv")}</FinanceButton>
          <FinanceButton variant="ghost">{t("headerActions.exportCsv")}</FinanceButton>
        </>
      }
    >
      <Panel>
        <PanelHead
          title={t("ledger.panelTitle")}
          sub={t("ledger.panelSub", {
            count: data.total.toLocaleString("hu-HU"),
            year: new Date().getFullYear().toString(),
          })}
          right={
            <form>
              <select
                name="account"
                defaultValue={account ?? ""}
                className="font-sans"
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  padding: "5px 10px",
                  border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  borderRadius: "6px",
                  background: "var(--color-bg-3)",
                  color: "var(--color-ink)",
                }}
              >
                <option value="">{t("ledger.allCategories")}</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </form>
          }
        />
        <FinanceLedgerTableTiles
          locale={locale}
          rows={data.rows}
          countLabel={t("ledger.shown", {
            shown: data.rows.length.toString(),
            total: data.total.toLocaleString("hu-HU"),
          })}
          syncLabel={t("ledger.pageInfo", {
            page: page.toString(),
            totalPages: totalPages.toString(),
          })}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex justify-between items-center font-mono"
            style={{
              padding: "14px 22px",
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            <PageLink
              locale={locale}
              page={page > 1 ? page - 1 : null}
              account={account}
              label={`← ${t("ledger.prev")}`}
            />
            <span>
              {page} / {totalPages}
            </span>
            <PageLink
              locale={locale}
              page={page < totalPages ? page + 1 : null}
              account={account}
              label={`${t("ledger.next")} →`}
            />
          </div>
        )}
      </Panel>
    </FinanceShell>
  );
}

function PageLink({
  locale,
  page,
  account,
  label,
}: {
  locale: string;
  page: number | null;
  account: string | undefined;
  label: string;
}) {
  if (!page) {
    return (
      <span style={{ opacity: 0.4, cursor: "not-allowed" }}>{label}</span>
    );
  }
  const qs = new URLSearchParams();
  qs.set("page", page.toString());
  if (account) qs.set("account", account);
  return (
    <a
      href={`/${locale}/finance/ledger?${qs}`}
      style={{
        color: "var(--color-ink-soft)",
        fontWeight: 600,
        textDecoration: "underline",
        textUnderlineOffset: "3px",
      }}
    >
      {label}
    </a>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
      }}
    >
      {children}
    </div>
  );
}

function PanelHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex justify-between items-center gap-3"
      style={{
        padding: "18px 22px",
        borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <div>
        <h3 style={{ fontSize: "17px", fontWeight: 600, letterSpacing: "-0.02em" }}>
          {title}
        </h3>
        {sub && (
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              marginTop: "2px",
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
