"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronDown,
  Pencil,
  Link2,
  Clock,
  FileText,
  FileQuestion,
} from "lucide-react";
import { type Feature, type FeatureModule } from "@/lib/features";
import type { CatalogFeature, PlanMatrix } from "@/lib/feature-access";
import type { FeatureFlagState } from "@/lib/feature-resolver";
import { MODULE_GLYPH, MODULE_ORDER, FEATURE_META, depList } from "./data";
import { makeCx } from "./cx";
import styles from "./feature-console.module.css";
import { KillSwitchDialog } from "./kill-switch-dialog";
import { patchFeature } from "./api";

const cx = makeCx(styles);

type Plan = PlanMatrix["plans"][number];

export function FeatureCatalog({
  initialCatalog,
  plans,
}: {
  initialCatalog: CatalogFeature[];
  plans: Plan[];
}) {
  const t = useTranslations("featureConsole");
  const [rows, setRows] = useState<CatalogFeature[]>(initialCatalog);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [killTarget, setKillTarget] = useState<CatalogFeature | null>(null);
  const [busy, setBusy] = useState(false);

  function patchRow(id: string, patch: Partial<CatalogFeature>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function setFlag(row: CatalogFeature, state: FeatureFlagState) {
    if (state === "KILL_SWITCH") {
      setKillTarget(row);
      return;
    }
    const prev = row.flagState;
    patchRow(row.id, { flagState: state });
    try {
      await patchFeature(row.id, { flagState: state });
      toast.success(
        state === "FORCE_ON"
          ? t("catalog.toastFlagForce")
          : t("catalog.toastFlagPlan")
      );
    } catch {
      patchRow(row.id, { flagState: prev });
      toast.error(t("catalog.toastFlagPlan"));
    }
  }

  async function confirmKill(row: CatalogFeature) {
    setKillTarget(null);
    patchRow(row.id, { flagState: "KILL_SWITCH" });
    try {
      await patchFeature(row.id, { flagState: "KILL_SWITCH" });
      toast.error(t("catalog.toastKillOn", { slug: row.slug }));
    } catch {
      patchRow(row.id, { flagState: "PER_PLAN" });
      toast.error(t("catalog.toastFlagPlan"));
    }
  }

  async function toggleActive(row: CatalogFeature) {
    const next = !row.isActive;
    patchRow(row.id, { isActive: next });
    setBusy(true);
    try {
      await patchFeature(row.id, { isActive: next });
      toast.success(
        next ? t("catalog.toastActivated") : t("catalog.toastDeactivated")
      );
    } catch {
      patchRow(row.id, { isActive: !next });
      toast.error(t("catalog.toastDeactivated"));
    } finally {
      setBusy(false);
    }
  }

  const killAffected = (row: CatalogFeature | null) =>
    row
      ? plans
          .filter((p) => row.plans[p.slug])
          .reduce((sum, p) => sum + p.activeSubscriptions, 0)
      : 0;

  return (
    <div className={cx("console")}>
      <div className={cx("page")}>
        <div className={cx("page-head")}>
          <div>
            <div className={cx("eyebrow")}>
              <span className={cx("pulse")} />
              {t("catalog.eyebrow")}
            </div>
            <h1>
              {t("catalog.title")}{" "}
              <span className={cx("soft")}>
                {t("catalog.countSummary", {
                  features: rows.length,
                  modules: MODULE_ORDER.length,
                })}
              </span>
            </h1>
            <p>{t("catalog.intro")}</p>
          </div>
          <div className={cx("hd-acts")}>
            <button className={cx("btn", "btn-ghost")}>
              <FileText /> {t("catalog.auditExport")}
            </button>
          </div>
        </div>

        <div className={cx("legend")}>
          <span className={cx("lg-title")}>{t("catalog.legendTitle")}</span>
          <span className={cx("lg-item")}>
            <span className={cx("eff", "kill")}>
              <span className={cx("gl")}>⏻</span>
              {t("badges.kill")}
            </span>{" "}
            {t("catalog.legendKillSuffix")}
          </span>
          <span className={cx("lg-item")}>›</span>
          <span className={cx("lg-item")}>
            <span className={cx("eff", "override")}>
              <span className={cx("gl")}>✎</span>
              {t("badges.override")}
            </span>{" "}
            {t("catalog.legendOverrideSuffix")}
          </span>
          <span className={cx("lg-item")}>›</span>
          <span className={cx("lg-item")}>
            <span className={cx("eff", "force")}>
              <span className={cx("gl")}>▲</span>
              {t("badges.force")}
            </span>
          </span>
          <span className={cx("lg-item")}>›</span>
          <span className={cx("lg-item")}>
            <span className={cx("eff", "plan")}>
              <span className={cx("gl")}>◷</span>
              {t("badges.plan")}
            </span>{" "}
            {t("catalog.legendPlanSuffix")}
          </span>
          <span className={cx("lg-sep")} />
          <span className={cx("lg-item")}>
            <span className={cx("avail-dot", "on")} />
            {t("catalog.available")}
          </span>
          <span className={cx("lg-item")}>
            <span className={cx("avail-dot", "off")} />
            {t("catalog.unavailable")}
          </span>
        </div>

        {MODULE_ORDER.map((mod) => {
          const feats = rows.filter((r) => r.module === mod);
          const modName = t(`modules.${mod}.name`);
          const modGloss = t(`modules.${mod}.gloss`);
          const onCount = feats.filter(
            (f) => f.isActive && f.flagState !== "KILL_SWITCH"
          ).length;
          const isCollapsed = collapsed[mod];
          return (
            <div key={mod} className={cx("mod-group", isCollapsed && "collapsed")}>
              <button
                className={cx("mod-head")}
                onClick={() => setCollapsed((p) => ({ ...p, [mod]: !p[mod] }))}
                aria-expanded={!isCollapsed}
              >
                <div className={cx("mglyph")}>{MODULE_GLYPH[mod as FeatureModule]}</div>
                <div>
                  <div className={cx("mtitle")}>{modName}</div>
                  <div className={cx("mslug", "mono")}>
                    {mod} · {modGloss}
                  </div>
                </div>
                <div className={cx("mcount", "mono")}>
                  {feats.length ? (
                    <>
                      <span className={cx("on-n")}>
                        {t("catalog.activeCount", { count: onCount })}
                      </span>{" "}
                      · {t("catalog.featureCount", { count: feats.length })}
                    </>
                  ) : (
                    t("catalog.moduleEmpty")
                  )}
                </div>
                <ChevronDown className={cx("chev")} />
              </button>
              <div className={cx("mod-body")}>
                {feats.length === 0 ? (
                  <div className={cx("empty")}>
                    <div className={cx("eglyph")}>
                      <FileQuestion />
                    </div>
                    <h4>{t("catalog.emptyTitle")}</h4>
                    <p>{t("catalog.emptyBody", { module: modName })}</p>
                  </div>
                ) : (
                  feats.map((row) => {
                    const f = row.slug as Feature;
                    const meta = FEATURE_META[f];
                    const name = t(`features.${f}.name`);
                    const deps = depList(f);
                    const flag = row.flagState;
                    return (
                      <div key={row.id} className={cx("frow")}>
                        <div className={cx("f-id")}>
                          <div className={cx("name")}>
                            {name}
                            {meta?.beta && (
                              <span className={cx("pt", "beta")}>
                                {t("catalog.beta")}
                              </span>
                            )}
                            <Pencil style={{ width: 13, height: 13, opacity: 0.4 }} />
                          </div>
                          <div className={cx("desc")}>{t(`features.${f}.desc`)}</div>
                          <div className={cx("meta")}>
                            {deps.length > 0 && (
                              <span className={cx("dep-hint")}>
                                <Link2 />
                                {t("catalog.requires", {
                                  deps: deps.map((d) => t(`features.${d}.name`)).join(", "),
                                })}
                              </span>
                            )}
                            <span className={cx("plan-tags")}>
                              <span className={cx("lbl")}>{t("catalog.plansLabel")}</span>
                              {plans.map((p) => (
                                <span
                                  key={p.slug}
                                  className={cx("pt", !row.plans[p.slug] && "off")}
                                >
                                  {p.name}
                                </span>
                              ))}
                            </span>
                          </div>
                          {meta && (
                            <div className={cx("meta")}>
                              <span className={cx("audit-line")}>
                                <Clock />
                                {t("catalog.modifiedBy", { by: meta.by, when: meta.when })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className={cx("f-active")}>
                          <div
                            className={cx("sw", row.isActive && "on")}
                            role="switch"
                            aria-checked={row.isActive}
                            aria-label={name}
                            tabIndex={0}
                            onClick={() => !busy && toggleActive(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!busy) toggleActive(row);
                              }
                            }}
                          />
                          <span className={cx("sw-lbl")}>
                            {row.isActive ? <b>{t("catalog.active")}</b> : t("catalog.inactive")}
                          </span>
                        </div>

                        <div className={cx("flag-ctl")}>
                          <div
                            className={cx("seg")}
                            role="radiogroup"
                            aria-label={t("catalog.flagAria", { name })}
                          >
                            <button
                              className={cx("plan", flag === "PER_PLAN" && "on")}
                              role="radio"
                              aria-checked={flag === "PER_PLAN"}
                              onClick={() => setFlag(row, "PER_PLAN")}
                            >
                              <span className={cx("d")} />
                              {t("catalog.flagPlan")}
                            </button>
                            <button
                              className={cx("force", flag === "FORCE_ON" && "on")}
                              role="radio"
                              aria-checked={flag === "FORCE_ON"}
                              onClick={() => setFlag(row, "FORCE_ON")}
                            >
                              <span className={cx("d")} />
                              {t("catalog.flagForce")}
                            </button>
                            <button
                              className={cx("kill", flag === "KILL_SWITCH" && "on")}
                              role="radio"
                              aria-checked={flag === "KILL_SWITCH"}
                              onClick={() => setFlag(row, "KILL_SWITCH")}
                            >
                              <span className={cx("d")} />
                              {t("catalog.flagKill")}
                            </button>
                          </div>
                          <span className={cx("flag-note", flag !== "PER_PLAN" && "warn")}>
                            {flag === "FORCE_ON"
                              ? t("catalog.flagNoteForce")
                              : flag === "KILL_SWITCH"
                                ? t("catalog.flagNoteKill")
                                : t("catalog.flagNotePlan")}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {killTarget && (
        <KillSwitchDialog
          slug={killTarget.slug}
          name={t(`features.${killTarget.slug}.name`)}
          affected={killAffected(killTarget)}
          onCancel={() => setKillTarget(null)}
          onConfirm={() => confirmKill(killTarget)}
        />
      )}
    </div>
  );
}
