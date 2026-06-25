"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, AlertTriangle, Link2, Info } from "lucide-react";
import { FEATURE_DEPENDENCIES, type Feature } from "@/lib/features";
import type { PlanMatrix } from "@/lib/feature-access";
import { MODULE_ORDER, depList } from "./data";
import { makeCx } from "./cx";
import styles from "./feature-console.module.css";
import { togglePlanFeature, patchPlan, fetchMatrix } from "./api";

const cx = makeCx(styles);

type Plan = PlanMatrix["plans"][number];
type FeatureRow = PlanMatrix["features"][number];

const NUMERIC: (keyof Plan)[] = ["maxBuildings", "maxUnitsPerBuilding", "trialDays"];
const LIMIT_FIELDS: { key: keyof Plan }[] = [
  { key: "maxBuildings" },
  { key: "maxUnitsPerBuilding" },
  { key: "priceMonthly" },
  { key: "priceYearly" },
  { key: "trialDays" },
];

export function PlanEditor({ initialMatrix }: { initialMatrix: PlanMatrix }) {
  const t = useTranslations("featureConsole");
  const [plans, setPlans] = useState<Plan[]>(initialMatrix.plans);
  const [features] = useState<FeatureRow[]>(initialMatrix.features);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(initialMatrix.enabled);

  const idToSlug = new Map(features.map((f) => [f.id, f.slug]));
  const isOn = (planId: string, featureId: string) => !!enabled[`${planId}:${featureId}`];

  function blockersFor(planId: string, featureId: string): FeatureRow[] {
    const slug = idToSlug.get(featureId) as Feature | undefined;
    if (!slug) return [];
    return features.filter(
      (x) =>
        isOn(planId, x.id) &&
        (FEATURE_DEPENDENCIES[x.slug as Feature] ?? []).includes(slug)
    );
  }

  async function toggle(plan: Plan, feature: FeatureRow) {
    const currentlyOn = isOn(plan.id, feature.id);
    if (currentlyOn && blockersFor(plan.id, feature.id).length > 0) {
      toast.error(t("planEditor.toastBlocked"));
      return;
    }
    const beforeOn = features.filter((f) => isOn(plan.id, f.id)).length;
    const res = await togglePlanFeature(plan.id, feature.id, !currentlyOn);
    if (!res.ok) {
      const name = res.blocker ? t(`features.${res.blocker}.name`) : "";
      toast.error(name ? `${t("planEditor.toastBlocked")} (${name})` : t("planEditor.toastBlocked"));
      return;
    }
    const fresh = await fetchMatrix();
    setEnabled(fresh.enabled);
    const afterOn = fresh.features.filter((f) => fresh.enabled[`${plan.id}:${f.id}`]).length;
    if (!currentlyOn && afterOn - beforeOn > 1) toast.success(t("planEditor.toastAutoEnabled"));
  }

  function updateLocal(planId: string, key: keyof Plan, value: string | number | boolean) {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, [key]: value } : p))
    );
  }

  async function persist(plan: Plan, key: keyof Plan) {
    const body: Record<string, unknown> = {};
    const v = plan[key];
    if (NUMERIC.includes(key)) body[key] = Number(v);
    else body[key] = v;
    try {
      await patchPlan(plan.id, body);
      toast.success(t("planEditor.saved"));
    } catch {
      toast.error(t("planEditor.toastBlocked"));
    }
  }

  const deactivated = plans.filter((p) => !p.isActive && p.activeSubscriptions > 0);

  return (
    <div className={cx("console")}>
      <div className={cx("page")}>
        <div className={cx("page-head")}>
          <div>
            <div className={cx("eyebrow")}>
              <span className={cx("pulse")} />
              {t("planEditor.eyebrow")}
            </div>
            <h1>
              {t("planEditor.title")}{" "}
              <span className={cx("soft")}>· {plans.map((p) => p.name).join(" · ")}</span>
            </h1>
            <p>{t("planEditor.intro")}</p>
          </div>
        </div>

        {deactivated.map((p) => (
          <div key={p.id} className={cx("guardrail")}>
            <AlertTriangle />
            <div>
              <strong>
                {t("planEditor.guardrailTitle", { plan: p.name, count: p.activeSubscriptions })}
              </strong>
              <p>{t("planEditor.guardrailBody")}</p>
            </div>
            <div className={cx("ga")}>
              <button
                className={cx("btn", "btn-ghost", "btn-sm")}
                onClick={() => {
                  updateLocal(p.id, "isActive", true);
                  void patchPlan(p.id, { isActive: true });
                }}
              >
                {t("planEditor.reactivate")}
              </button>
            </div>
          </div>
        ))}

        <div className={cx("plan-layout")}>
          <div className={cx("matrix-wrap")}>
            <div className={cx("matrix-scroll")}>
              <table className={cx("matrix")}>
                <thead>
                  <tr>
                    <th className={cx("feat-col")}>{t("planEditor.featCol")}</th>
                    {plans.map((p) => (
                      <th key={p.id} className={cx("plan-col")}>
                        <div className={cx("pn")}>{p.name}</div>
                        <div className={cx("pp", "mono")}>{p.priceMonthly} Ft</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULE_ORDER.map((mod) => {
                    const feats = features.filter((f) => f.module === mod);
                    if (feats.length === 0) return null;
                    return (
                      <FragmentRows
                        key={mod}
                        mod={mod}
                        modName={t(`modules.${mod}.name`)}
                        feats={feats}
                        plans={plans}
                        isOn={isOn}
                        blockersFor={blockersFor}
                        featureName={(slug) => t(`features.${slug}.name`)}
                        blockedTooltip={(blocker) => t("planEditor.blockedTooltip", { blocker })}
                        onToggle={toggle}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cx("plan-panels")}>
            {plans.map((p) => (
              <div key={p.id} className={cx("plan-card")}>
                <div className={cx("pc-h")}>
                  <span className={cx("nm")}>{p.name}</span>
                </div>
                <div className={cx("pc-b")}>
                  {LIMIT_FIELDS.map((field) => (
                    <div key={String(field.key)} className={cx("lim")}>
                      <label>{t(`planEditor.limits.${field.key}`)}</label>
                      <input
                        type={NUMERIC.includes(field.key) ? "number" : "text"}
                        value={String(p[field.key] ?? "")}
                        onChange={(e) =>
                          updateLocal(
                            p.id,
                            field.key,
                            NUMERIC.includes(field.key) ? Number(e.target.value) : e.target.value
                          )
                        }
                        onBlur={() => persist(p, field.key)}
                      />
                    </div>
                  ))}
                  <div className={cx("lim")}>
                    <label>{t("planEditor.limits.isActive")}</label>
                    <span
                      className={cx("sw", p.isActive && "on")}
                      role="switch"
                      aria-checked={p.isActive}
                      aria-label={`${t("planEditor.limits.isActive")} — ${p.name}`}
                      tabIndex={0}
                      onClick={() => {
                        const next = !p.isActive;
                        updateLocal(p.id, "isActive", next);
                        void patchPlan(p.id, { isActive: next });
                      }}
                    />
                  </div>
                </div>
                <div className={cx("pc-warn")}>
                  <Info />
                  <span>{t("planEditor.priceWarn")}</span>
                </div>
                <div className={cx("pc-stripe")}>
                  <label>{t("planEditor.limits.stripePriceId")}</label>
                  <input
                    type="text"
                    className={cx("mono")}
                    value={p.stripePriceId ?? ""}
                    onChange={(e) => updateLocal(p.id, "stripePriceId", e.target.value)}
                    onBlur={() => persist(p, "stripePriceId")}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FragmentRows({
  mod,
  modName,
  feats,
  plans,
  isOn,
  blockersFor,
  featureName,
  blockedTooltip,
  onToggle,
}: {
  mod: string;
  modName: string;
  feats: FeatureRow[];
  plans: Plan[];
  isOn: (planId: string, featureId: string) => boolean;
  blockersFor: (planId: string, featureId: string) => FeatureRow[];
  featureName: (slug: string) => string;
  blockedTooltip: (blocker: string) => string;
  onToggle: (plan: Plan, feature: FeatureRow) => void;
}) {
  return (
    <>
      <tr className={cx("mx-mod-row")}>
        <td colSpan={plans.length + 1}>
          {modName} · {mod}
        </td>
      </tr>
      {feats.map((f) => {
        const deps = depList(f.slug as Feature);
        return (
          <tr key={f.id} className={cx("mx-row")}>
            <td className={cx("mx-feat")}>
              <div className={cx("nm")}>{featureName(f.slug)}</div>
              {deps.length > 0 && (
                <div className={cx("dep")}>
                  <Link2 /> {deps.map((d) => featureName(d)).join(", ")}
                </div>
              )}
            </td>
            {plans.map((p) => {
              const on = isOn(p.id, f.id);
              const blockers = on ? blockersFor(p.id, f.id) : [];
              const blocked = blockers.length > 0;
              return (
                <td key={p.id} className={cx("mx-cell")}>
                  <span className={cx("tip")}>
                    <span
                      className={cx("cbx", on && "on", blocked && "locked")}
                      role="checkbox"
                      aria-checked={on}
                      aria-disabled={blocked}
                      aria-label={`${featureName(f.slug)} — ${p.name}`}
                      tabIndex={0}
                      onClick={() => onToggle(p, f)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onToggle(p, f);
                        }
                      }}
                    >
                      <Check />
                    </span>
                    {blocked && (
                      <span className={cx("tip-body")}>
                        {blockedTooltip(featureName(blockers[0].slug))}
                      </span>
                    )}
                  </span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
