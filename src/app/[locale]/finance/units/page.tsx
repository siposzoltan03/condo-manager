import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasMinimumRole } from "@/lib/rbac";
import { getDashboardContext } from "@/lib/dal";
import { getFinanceUnits, type FinanceUnitRow } from "@/lib/finance-dal";
import { redirect } from "next/navigation";
import { FinanceShell } from "@/components/finance/finance-shell";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrearsDisclosureWarning } from "@/components/compliance/arrears-disclosure-warning";

type Props = {
  params: Promise<{ locale: string; filter?: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function FinanceUnitsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { filter } = await searchParams;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  if (!hasMinimumRole(ctx.role, "BOARD_MEMBER")) {
    redirect(`/${locale}/finance`);
  }

  const data = await getFinanceUnits();
  const t = await getTranslations({ locale, namespace: "finance" });
  // Phase 5 — NAIH-compliant disclosure mode for the arrears warning.
  // This page renders owner names + outstanding balances; we surface the
  // active mode above the table as a reminder of the disclosure rules.
  const { buildingId } = await requireBuildingContext();
  const compliance = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { arrearsDisclosureMode: true },
  });
  const tArrears = await getTranslations({ locale, namespace: "compliance.arrears" });

  // Apply filter chip server-side.
  const rows: FinanceUnitRow[] = (() => {
    if (filter === "healthy") return data.rows.filter((r) => r.outstandingBalance >= 0);
    if (filter === "arrears") return data.rows.filter((r) => r.outstandingBalance < 0);
    return data.rows;
  })();

  return (
    <FinanceShell
      locale={locale}
      active="units"
      counts={{ units: data.summary.totalUnits }}
      titleKey="finance.units.title"
      ledeKey="finance.units.lede"
    >
      {compliance && (
        <ArrearsDisclosureWarning
          mode={compliance.arrearsDisclosureMode}
          copy={{ title: tArrears("title"), description: tArrears("description") }}
        />
      )}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
        }}
      >
        {/* Filter chip header */}
        <div
          className="flex justify-between items-end gap-4 flex-wrap"
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "22px",
                fontWeight: 500,
                letterSpacing: "-0.025em",
              }}
            >
              {t("units.headerTitle")}{" "}
              <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                · {t("units.headerSuffix")}
              </span>
            </h2>
            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                margin: "4px 0 0",
                letterSpacing: "0.05em",
              }}
            >
              {data.summary.totalUnits} {t("units.summaryUnits")} ·{" "}
              {data.summary.arrearsCount} {t("units.summaryArrears")} ·{" "}
              {Math.round(data.summary.arrearsTotalFt).toLocaleString("hu-HU")} Ft{" "}
              {t("units.summaryOpen")}
            </p>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <FilterChip
              locale={locale}
              filter={null}
              active={!filter}
              count={data.summary.totalUnits}
            >
              {t("units.filterAll")}
            </FilterChip>
            <FilterChip
              locale={locale}
              filter="healthy"
              active={filter === "healthy"}
              count={data.summary.healthyCount}
            >
              {t("units.filterHealthy")}
            </FilterChip>
            <FilterChip
              locale={locale}
              filter="arrears"
              active={filter === "arrears"}
              count={data.summary.arrearsCount}
              danger
            >
              {t("units.filterArrears")}
            </FilterChip>
          </div>
        </div>

        {/* Table header */}
        <div
          className="font-mono grid"
          style={{
            gridTemplateColumns: "56px 1.3fr 1fr 1fr 160px 110px 40px",
            gap: "16px",
            padding: "10px 22px",
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "var(--color-bg-3)",
            borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <span>{t("units.colUnit")}</span>
          <span>{t("units.colOwner")}</span>
          <span>{t("units.colFee")}</span>
          <span>{t("units.colBalance")}</span>
          <span>{t("units.colMonths")}</span>
          <span>{t("units.colLastPaid")}</span>
          <span />
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--color-muted)",
              fontSize: "13px",
            }}
          >
            {t("units.empty")}
          </div>
        ) : (
          rows.map((row, i) => <UnitRow key={row.unitId} row={row} last={i === rows.length - 1} />)
        )}
      </div>
    </FinanceShell>
  );
}

function FilterChip({
  locale,
  filter,
  active,
  count,
  danger,
  children,
}: {
  locale: string;
  filter: string | null;
  active: boolean;
  count: number;
  danger?: boolean;
  children: React.ReactNode;
}) {
  void locale;
  const params = filter ? `?filter=${filter}` : "";
  return (
    <a
      href={`/${locale}/finance/units${params}`}
      className="transition-colors"
      style={{
        fontSize: "12px",
        padding: "6px 12px",
        borderRadius: "6px",
        border: active
          ? "1px solid var(--color-ink)"
          : danger
            ? "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)"
            : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: active ? "var(--color-ink)" : "var(--color-card)",
        color: active
          ? "var(--color-bg)"
          : danger
            ? "var(--color-danger)"
            : "var(--color-ink-soft)",
        fontWeight: 500,
        textDecoration: "none",
      }}
    >
      {children}
      <span
        className="font-mono"
        style={{
          marginLeft: "6px",
          fontSize: "10px",
          opacity: 0.6,
        }}
      >
        {count}
      </span>
    </a>
  );
}

function UnitRow({ row, last }: { row: FinanceUnitRow; last: boolean }) {
  const lastPaidLabel = row.lastPaidAt
    ? new Date(row.lastPaidAt).toLocaleDateString("hu-HU", {
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
  return (
    <div
      className="grid items-center hover:bg-[var(--color-bg-3)] transition-colors"
      style={{
        gridTemplateColumns: "56px 1.3fr 1fr 1fr 160px 110px 40px",
        gap: "16px",
        padding: "13px 22px",
        borderBottom: last
          ? "none"
          : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        fontSize: "13px",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {row.unitLabel}
      </span>
      <span>
        <strong style={{ display: "block", fontWeight: 600, letterSpacing: "-0.005em" }}>
          {row.ownerName}
        </strong>
        <small
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.04em" }}
        >
          {row.ownerSize}
        </small>
      </span>
      <span
        className="font-mono"
        style={{ fontSize: "12.5px", fontWeight: 600 }}
      >
        {Math.round(row.monthlyFee).toLocaleString("hu-HU")} Ft
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: "12.5px",
          fontWeight: 600,
          color: row.outstandingBalance < 0 ? "var(--color-danger)" : "var(--color-ink)",
        }}
      >
        {row.outstandingBalance < 0 ? "−" : ""}
        {Math.round(Math.abs(row.outstandingBalance)).toLocaleString("hu-HU")}
      </span>
      <span className="flex gap-[3px]">
        {row.monthlyStatus.map((s, i) => (
          <i
            key={i}
            style={{
              width: "10px",
              height: "18px",
              borderRadius: "2px",
              background:
                s === "paid"
                  ? "var(--color-moss-2)"
                  : s === "overdue"
                    ? "var(--color-danger)"
                    : s === "pending"
                      ? "var(--color-ochre)"
                      : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
            }}
          />
        ))}
      </span>
      <span
        className="font-mono"
        style={{ color: "var(--color-muted)", fontSize: "11px" }}
      >
        {lastPaidLabel}
      </span>
      <span style={{ color: "var(--color-muted)", textAlign: "right" }}>›</span>
    </div>
  );
}
