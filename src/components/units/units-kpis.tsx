import { getTranslations } from "next-intl/server";
import type { UnitsKpis } from "@/lib/units-dal";

interface Props {
  locale: string;
  kpis: UnitsKpis;
}

export async function UnitsKpiStrip({ locale, kpis }: Props) {
  const t = await getTranslations({ locale, namespace: "units.kpi" });

  const ownerPct =
    kpis.total > 0 ? Math.round((kpis.ownerOccupied / kpis.total) * 100) : 0;
  const tenantPct =
    kpis.total > 0 ? Math.round((kpis.tenantOccupied / kpis.total) * 100) : 0;
  const vacantPct =
    kpis.total > 0 ? Math.round((kpis.vacant / kpis.total) * 100) : 0;

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      style={{ gap: "12px", marginBottom: "24px" }}
    >
      <Tile label={t("total")} value={kpis.total.toString()} />
      <Tile
        label={t("ownerOccupied")}
        value={kpis.ownerOccupied.toString()}
        unit={`· ${ownerPct}%`}
        accent="moss"
      />
      <Tile
        label={t("tenant")}
        value={kpis.tenantOccupied.toString()}
        unit={`· ${tenantPct}%`}
      />
      <Tile
        label={t("vacant")}
        value={kpis.vacant.toString()}
        unit={`· ${vacantPct}%`}
      />
      <Tile
        label={t("totalArea")}
        value={Math.round(kpis.totalAreaM2).toLocaleString("hu-HU")}
        unit="m²"
        accent="ink"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: "moss" | "ink";
}) {
  const styles =
    accent === "moss"
      ? {
          bg: "var(--color-moss)",
          color: "#f5f2e6",
          border: "transparent",
          subColor: "color-mix(in srgb, #f5f2e6 70%, transparent)",
        }
      : accent === "ink"
        ? {
            bg: "var(--color-ink)",
            color: "var(--color-bg)",
            border: "transparent",
            subColor: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
          }
        : {
            bg: "var(--color-card)",
            color: "var(--color-ink)",
            border: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
            subColor: "var(--color-muted)",
          };

  return (
    <div
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        borderRadius: "12px",
        padding: "14px 16px",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: styles.subColor,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          marginTop: "4px",
        }}
      >
        {value}
        {unit && (
          <small
            style={{
              fontSize: "13px",
              color: styles.subColor,
              marginLeft: "4px",
              fontWeight: 400,
            }}
          >
            {unit}
          </small>
        )}
      </div>
    </div>
  );
}
