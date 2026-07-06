"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { FeatureAuditRow } from "@/lib/feature-access";
import { fetchFeatureAudit } from "./api";

/** Map a dotted audit action to a flat i18n key segment. */
const ACTION_KEY: Record<string, string> = {
  "feature.update": "feature_update",
  "feature.flag.update": "feature_flag_update",
  "plan.feature.toggle": "plan_feature_toggle",
  "plan.limits.update": "plan_limits_update",
  "building.feature.override": "building_feature_override",
};

/**
 * Feature-management audit trail. These rows are platform-level (buildingId
 * usually null) so they don't appear in the building-scoped audit viewer —
 * this is the only place a superadmin can see who changed feature access.
 */
export function AuditHistory() {
  const t = useTranslations("featureConsole");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "hu-HU";
  const [rows, setRows] = useState<FeatureAuditRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFeatureAudit()
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p style={muted}>{t("audit.error")}</p>;
  }
  if (rows === null) {
    return <p style={muted}>{t("audit.loading")}</p>;
  }
  if (rows.length === 0) {
    return <p style={muted}>{t("audit.empty")}</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <Th>{t("audit.col.when")}</Th>
            <Th>{t("audit.col.who")}</Th>
            <Th>{t("audit.col.what")}</Th>
            <Th>{t("audit.col.target")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const actionKey = ACTION_KEY[r.action];
            return (
              <tr key={r.id} style={{ borderTop: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)" }}>
                <Td mono>
                  {new Date(r.createdAt).toLocaleString(dateLocale, {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td>{r.actorName ?? "—"}</Td>
                <Td>{actionKey ? t(`audit.action.${actionKey}`) : r.action}</Td>
                <Td mono>
                  {r.entityType}
                  <span style={{ color: "var(--color-muted)" }}> · {r.entityId.slice(-8)}</span>
                  {r.reason ? (
                    <div style={{ color: "var(--color-muted)", fontFamily: "inherit", marginTop: 2 }}>
                      {r.reason}
                    </div>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 13, color: "var(--color-muted)", padding: "16px 4px" };

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 10px",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--color-muted)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "9px 10px",
        verticalAlign: "top",
        fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
        fontSize: mono ? 11.5 : 13,
        color: "var(--color-ink-soft)",
      }}
    >
      {children}
    </td>
  );
}
