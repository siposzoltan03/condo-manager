import type { FinanceKPI } from "@/lib/finance-dal";
import { getTranslations } from "next-intl/server";

function formatHUF(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2);
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toString();
}

function formatHUFFull(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("hu-HU");
}

interface Props {
  locale: string;
  kpi: FinanceKPI;
}

export async function FinanceKPIs({ locale, kpi }: Props) {
  const t = await getTranslations({ locale, namespace: "finance.kpi" });

  // Sparkline normalized 0..100 heights for display.
  const maxSpark = Math.max(...kpi.incomeSparkline, 1);
  const sparkHeights = kpi.incomeSparkline.map((v) =>
    Math.max(8, Math.round((v / maxSpark) * 100)),
  );

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      style={{ marginBottom: "28px" }}
    >
      {/* Operating */}
      <KpiCard
        variant="dark"
        label={t("operating")}
        icon="₣"
        value={formatHUF(kpi.operatingBalance)}
        unit={Math.abs(kpi.operatingBalance) >= 1_000_000 ? "M Ft" : "Ft"}
        sub={
          <>
            <span className="font-mono">
              {kpi.operatingMonthlyDelta >= 0 ? "+" : "−"}
              {formatHUFFull(kpi.operatingMonthlyDelta)} Ft
            </span>{" "}
            {t("thisMonth")}
          </>
        }
      />
      {/* Reserve */}
      <KpiCard
        variant="moss"
        label={t("reserve")}
        icon="◈"
        value={formatHUF(kpi.reserveBalance)}
        unit={Math.abs(kpi.reserveBalance) >= 1_000_000 ? "M Ft" : "Ft"}
        sub={
          kpi.reserveTarget > 0
            ? `${t("targetLabel", { target: (kpi.reserveTarget / 1_000_000).toFixed(0) })} / ${
                Math.round((kpi.reserveBalance / kpi.reserveTarget) * 100)
              }%`
            : ""
        }
      />
      {/* Income YTD with sparkline */}
      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "20px 22px",
        }}
      >
        <div
          className="font-mono flex items-center gap-2"
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
          }}
        >
          <span
            className="grid place-items-center"
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              background: "var(--color-good-soft, #d9e2cd)",
              color: "var(--color-good)",
              fontSize: "12px",
            }}
          >
            ↗
          </span>
          {t("incomeYTD")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "38px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            margin: "14px 0 4px",
          }}
        >
          {formatHUF(kpi.incomeYTD)}
          <small
            style={{
              fontSize: "18px",
              marginLeft: "4px",
              fontWeight: 400,
              color: "var(--color-muted)",
            }}
          >
            {Math.abs(kpi.incomeYTD) >= 1_000_000 ? "M Ft" : "Ft"}
          </small>
        </div>
        <div
          className="flex items-end gap-[3px]"
          style={{ height: "26px", marginTop: "12px" }}
        >
          {sparkHeights.map((h, i) => {
            const isHi = i >= sparkHeights.length - 2;
            return (
              <i
                key={i}
                className="flex-1"
                style={{
                  minHeight: "4px",
                  height: `${h}%`,
                  borderRadius: "2px",
                  background: isHi
                    ? "var(--color-ink)"
                    : "color-mix(in srgb, var(--color-ink) 35%, transparent)",
                }}
              />
            );
          })}
        </div>
      </div>
      {/* Expense YTD */}
      <KpiCard
        label={t("expenseYTD")}
        icon="↘"
        iconBg="var(--color-danger-soft, #f2d6cc)"
        iconColor="var(--color-danger)"
        value={formatHUF(kpi.expenseYTD)}
        unit={Math.abs(kpi.expenseYTD) >= 1_000_000 ? "M Ft" : "Ft"}
        sub={
          kpi.expenseYTD < kpi.incomeYTD
            ? t("underBudget")
            : t("overBudget")
        }
      />
    </div>
  );
}

function KpiCard({
  variant,
  label,
  icon,
  iconBg,
  iconColor,
  value,
  unit,
  sub,
}: {
  variant?: "dark" | "moss";
  label: string;
  icon: string;
  iconBg?: string;
  iconColor?: string;
  value: string;
  unit?: string;
  sub: React.ReactNode;
}) {
  const bg =
    variant === "dark"
      ? "var(--color-ink)"
      : variant === "moss"
        ? "var(--color-moss)"
        : "var(--color-card)";
  const fg =
    variant === "dark" || variant === "moss" ? "#f5f2e6" : "var(--color-ink)";
  const subColor = variant
    ? "color-mix(in srgb, currentColor 75%, transparent)"
    : "var(--color-ink-soft)";
  const labelColor = variant
    ? "color-mix(in srgb, currentColor 65%, transparent)"
    : "var(--color-muted)";
  const defaultIconBg = variant
    ? "color-mix(in srgb, currentColor 15%, transparent)"
    : iconBg ?? "color-mix(in srgb, var(--color-ink) 8%, transparent)";

  return (
    <div
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${variant ? bg : "color-mix(in srgb, var(--color-ink) 10%, transparent)"}`,
        borderRadius: "14px",
        padding: "20px 22px",
      }}
    >
      <div
        className="font-mono flex items-center gap-2"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: labelColor,
        }}
      >
        <span
          className="grid place-items-center"
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            background: defaultIconBg,
            color: iconColor ?? "currentColor",
            fontSize: "12px",
          }}
        >
          {icon}
        </span>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "38px",
          fontWeight: 500,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          margin: "14px 0 4px",
        }}
      >
        {value}
        {unit && (
          <small
            style={{
              fontSize: "18px",
              marginLeft: "4px",
              fontWeight: 400,
              color: variant
                ? "color-mix(in srgb, currentColor 60%, transparent)"
                : "var(--color-muted)",
            }}
          >
            {unit}
          </small>
        )}
      </div>
      <div style={{ fontSize: "12px", color: subColor }}>{sub}</div>
    </div>
  );
}
