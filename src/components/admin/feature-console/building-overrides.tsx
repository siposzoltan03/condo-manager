"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { type Feature } from "@/lib/features";
import type { BuildingOverrideView, OverrideViewRow } from "@/lib/feature-access";
import { depList } from "./data";
import { makeCx } from "./cx";
import styles from "./feature-console.module.css";
import { putOverride, deleteOverride, fetchOverrideView } from "./api";

const cx = makeCx(styles);

type Source = OverrideViewRow["source"];
const GLYPH: Record<Source, string> = { kill: "⏻", override: "✎", force: "▲", plan: "◷" };
type TriState = "inherit" | "grant" | "revoke";

function stateOf(row: OverrideViewRow): TriState {
  if (!row.override) return "inherit";
  return row.override.grant ? "grant" : "revoke";
}

export function BuildingOverrides({
  initialView,
  buildingId,
  planLabels,
}: {
  initialView: BuildingOverrideView;
  buildingId: string;
  planLabels: Record<string, string>;
}) {
  const t = useTranslations("featureConsole");
  const [view, setView] = useState<BuildingOverrideView>(initialView);

  const planName = view.building.planSlug
    ? planLabels[view.building.planSlug] ?? view.building.planSlug
    : "—";
  const featureName = (slug: string) => t(`features.${slug}.name`);
  const availableBySlug = useMemo(
    () => new Map(view.rows.map((r) => [r.slug, r.available])),
    [view.rows]
  );

  async function refresh() {
    setView(await fetchOverrideView(buildingId));
  }

  async function setState(row: OverrideViewRow, next: TriState) {
    try {
      if (next === "inherit") {
        await deleteOverride(buildingId, row.id);
      } else {
        await putOverride(buildingId, {
          featureId: row.id,
          grant: next === "grant",
          reason: row.override?.reason ?? null,
          expiresAt: row.override?.expiresAt ?? null,
        });
      }
      await refresh();
      toast[next === "revoke" ? "error" : "success"](
        next === "inherit"
          ? t("overrides.toastInherit")
          : next === "grant"
            ? t("overrides.toastGrant")
            : t("overrides.toastRevoke")
      );
    } catch {
      toast.error(t("overrides.toastInherit"));
    }
  }

  function editField(row: OverrideViewRow, key: "reason" | "expiresAt", value: string) {
    setView((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.id === row.id && r.override
          ? { ...r, override: { ...r.override, [key]: value } }
          : r
      ),
    }));
  }

  async function persistField(row: OverrideViewRow) {
    if (!row.override) return;
    try {
      await putOverride(buildingId, {
        featureId: row.id,
        grant: row.override.grant,
        reason: row.override.reason ?? null,
        expiresAt: row.override.expiresAt ?? null,
      });
    } catch {
      toast.error(t("overrides.toastInherit"));
    }
  }

  return (
    <div className={cx("console")}>
      <div className={cx("page")}>
        <div className={cx("page-head")}>
          <div>
            <div className={cx("eyebrow")}>
              <span className={cx("pulse")} />
              {t("overrides.eyebrow")}
            </div>
            <h1>{t("overrides.title")}</h1>
            <p>{t("overrides.intro")}</p>
          </div>
          <div className={cx("hd-acts")}>
            <button className={cx("btn", "btn-ghost", "btn-sm")}>
              {t("overrides.auditHistory")}
            </button>
          </div>
        </div>

        <div className={cx("bld-header")}>
          <div className={cx("bi")}>
            {view.building.name.slice(0, 2).toUpperCase()}
          </div>
          <div className={cx("bx")}>
            <h2>{view.building.name}</h2>
            <div className={cx("addr", "mono")}>{view.building.address}</div>
          </div>
          <div className={cx("bstats")}>
            <div className={cx("bstat")}>
              <div className={cx("l")}>{t("overrides.statPlan")}</div>
              <div className={cx("v")}>{planName}</div>
            </div>
            <div className={cx("bstat")}>
              <div className={cx("l")}>{t("overrides.statUnits")}</div>
              <div className={cx("v")}>{view.building.units}</div>
            </div>
            <div className={cx("bstat")}>
              <div className={cx("l")}>{t("overrides.statSubscription")}</div>
              <div className={cx("v", "good")}>{t("overrides.statusActive")}</div>
            </div>
          </div>
        </div>

        <div className={cx("ov-table")}>
          <div className={cx("ov-head")}>
            <div>{t("overrides.colFeature")}</div>
            <div>{t("overrides.colOverride")}</div>
            <div>{t("overrides.colDetails")}</div>
          </div>

          {view.rows.map((row) => {
            const st = stateOf(row);
            const deps = depList(row.slug as Feature);
            const missing = deps
              .filter((d) => availableBySlug.get(d) === false)
              .map((d) => featureName(d));
            return (
              <div key={row.id} className={cx("ov-row", row.cascade && "warned")}>
                <div className={cx("ov-feat")}>
                  <div className={cx("nm")}>{featureName(row.slug)}</div>
                  {deps.length > 0 && (
                    <div className={cx("sl")}>
                      {t("catalog.requires", {
                        deps: deps.map((d) => featureName(d)).join(", "),
                      })}
                    </div>
                  )}
                  <div className={cx("why-source")} style={{ marginTop: 8 }}>
                    <span className={cx("eff", row.source)}>
                      <span className={cx("gl")}>{GLYPH[row.source]}</span>
                      {t(`badges.${row.source}`)}
                    </span>
                    <span className={cx("avail-chip", !(row.available && !row.cascade) && "off")}>
                      <span className={cx("avail-dot", row.available && !row.cascade ? "on" : "off")} />
                      {row.available && !row.cascade
                        ? t("catalog.available")
                        : row.cascade
                          ? t("overrides.ineffective")
                          : t("catalog.unavailable")}
                    </span>
                  </div>
                </div>

                <div className={cx("ov-state")}>
                  <div
                    className={cx("tri")}
                    role="radiogroup"
                    aria-label={`${t("overrides.colOverride")} — ${featureName(row.slug)}`}
                  >
                    <button
                      className={cx("inherit", st === "inherit" && "on")}
                      onClick={() => setState(row, "inherit")}
                    >
                      {t("overrides.inherit")}
                    </button>
                    <button
                      className={cx("grant", st === "grant" && "on")}
                      onClick={() => setState(row, "grant")}
                    >
                      {t("overrides.grant")}
                    </button>
                    <button
                      className={cx("revoke", st === "revoke" && "on")}
                      onClick={() => setState(row, "revoke")}
                    >
                      {t("overrides.revoke")}
                    </button>
                  </div>
                </div>

                <div className={cx("ov-detail")}>
                  {row.override && (
                    <div className={cx("ov-override-fields")}>
                      <div className={cx("ff")}>
                        <label>{t("overrides.reasonLabel")}</label>
                        <input
                          type="text"
                          value={row.override.reason ?? ""}
                          placeholder={t("overrides.reasonPlaceholder")}
                          onChange={(e) => editField(row, "reason", e.target.value)}
                          onBlur={() => persistField(row)}
                        />
                      </div>
                      <div className={cx("row2")}>
                        <div className={cx("ff")}>
                          <label>{t("overrides.expiryLabel")}</label>
                          <input
                            type="date"
                            value={row.override.expiresAt ? row.override.expiresAt.slice(0, 10) : ""}
                            onChange={(e) =>
                              editField(
                                row,
                                "expiresAt",
                                e.target.value ? new Date(e.target.value).toISOString() : ""
                              )
                            }
                            onBlur={() => persistField(row)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {row.cascade && (
                    <div className={cx("cascade-warn")}>
                      <AlertTriangle />
                      <div>
                        <b>{t("overrides.cascadeTitle")}</b>{" "}
                        {t("overrides.cascadeBody", { deps: missing.join(", ") })}
                      </div>
                    </div>
                  )}

                  {st === "inherit" && !row.cascade && (
                    <span className={cx("audit-line")}>
                      {row.source === "plan"
                        ? row.available
                          ? t("overrides.planIncluded", { plan: planName })
                          : t("overrides.planExcluded", { plan: planName })
                        : row.source === "force"
                          ? t("overrides.forceOn")
                          : row.source === "kill"
                            ? t("overrides.killUnder")
                            : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
