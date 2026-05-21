import { getTranslations } from "next-intl/server";
import type { FinanceBudgetRow } from "@/lib/finance-dal";

interface Props {
  locale: string;
  rows: FinanceBudgetRow[];
  plannedTotal: number;
  actualTotal: number;
  /** When true, render only rows (no totals footer / no border). */
  embed?: boolean;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("hu-HU");
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toString();
}

export async function FinanceBudgetPanel({
  locale,
  rows,
  plannedTotal,
  actualTotal,
  embed,
}: Props) {
  const t = await getTranslations({ locale, namespace: "finance.budget" });

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
        }}
      >
        {t("empty")}
      </div>
    );
  }

  return (
    <div style={{ padding: "22px" }}>
      {rows.map((r, idx) => {
        const isOver = r.ratio > 1;
        const pct = Math.min(100, Math.round(r.ratio * 100));
        const trackColor = isOver
          ? "var(--color-danger)"
          : r.actual === 0
            ? "var(--color-ochre)"
            : "var(--color-moss)";
        const remaining = r.planned - r.actual;
        return (
          <div
            key={r.accountId}
            style={{
              padding: idx === 0 ? "0 0 14px" : "14px 0",
              borderBottom:
                idx < rows.length - 1
                  ? "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)"
                  : "none",
            }}
          >
            <div
              className="flex justify-between items-baseline"
              style={{ marginBottom: "8px" }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "13.5px",
                  letterSpacing: "-0.005em",
                }}
              >
                {r.accountName}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: "12px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.02em",
                }}
              >
                <b
                  style={{
                    color: isOver ? "var(--color-danger)" : "var(--color-ink)",
                    fontWeight: 600,
                  }}
                >
                  {fmt(r.actual)}
                </b>{" "}
                / {fmt(r.planned)}
              </span>
            </div>
            <div
              style={{
                height: "6px",
                background: "color-mix(in srgb, var(--color-ink) 7%, transparent)",
                borderRadius: "999px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <span
                className="block transition-all"
                style={{
                  height: "100%",
                  width: `${isOver ? 100 : pct}%`,
                  background: trackColor,
                  borderRadius: "999px",
                }}
              />
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                color: isOver ? "var(--color-danger)" : "var(--color-muted)",
                marginTop: "4px",
                letterSpacing: "0.04em",
              }}
            >
              {Math.round(r.ratio * 100)}% ·{" "}
              {isOver
                ? `${fmt(Math.abs(remaining))} Ft ${t("over")}`
                : r.actual === 0
                  ? t("notStarted")
                  : `${fmt(remaining)} Ft ${t("remaining")}`}
            </div>
          </div>
        );
      })}

      {!embed && (
        <div
          className="flex justify-between items-baseline"
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "2px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          <span>{t("total")}</span>
          <span>
            {fmtCompact(actualTotal)}
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                fontWeight: 400,
                letterSpacing: "0.05em",
                marginLeft: "8px",
              }}
            >
              / {fmtCompact(plannedTotal)} FT
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
