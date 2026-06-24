"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ListChecks, LayoutGrid, Building2 } from "lucide-react";
import type {
  CatalogFeature,
  PlanMatrix,
  BuildingOverrideView,
} from "@/lib/feature-access";
import { makeCx } from "./cx";
import styles from "./feature-console.module.css";
import { FeatureCatalog } from "./feature-catalog";
import { PlanEditor } from "./plan-editor";
import { BuildingOverrides } from "./building-overrides";

const cx = makeCx(styles);

type View = "features" | "plans" | "buildings";

const TABS: { id: View; icon: typeof ListChecks }[] = [
  { id: "features", icon: ListChecks },
  { id: "plans", icon: LayoutGrid },
  { id: "buildings", icon: Building2 },
];

export function FeatureConsole({
  catalog,
  matrix,
  overrideView,
  buildingId,
}: {
  catalog: CatalogFeature[];
  matrix: PlanMatrix;
  overrideView: BuildingOverrideView | null;
  buildingId: string | null;
}) {
  const t = useTranslations("featureConsole");
  const [view, setView] = useState<View>("features");

  // plan slug → display name (DB names; the i18n tier names don't map to the
  // current starter/pro/enterprise/legacy slugs).
  const planLabels = useMemo(
    () => Object.fromEntries(matrix.plans.map((p) => [p.slug, p.name])),
    [matrix.plans]
  );

  return (
    <div>
      <div
        className={styles.console}
        style={{ marginBottom: 20 }}
        role="tablist"
        aria-label={t("tabs.aria")}
      >
        <div className={cx("states-bar")}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={cx(view === tab.id && "on")}
                role="tab"
                aria-selected={view === tab.id}
                onClick={() => setView(tab.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {t(`tabs.${tab.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      {view === "features" && (
        <FeatureCatalog initialCatalog={catalog} plans={matrix.plans} />
      )}
      {view === "plans" && <PlanEditor initialMatrix={matrix} />}
      {view === "buildings" &&
        (overrideView && buildingId ? (
          <BuildingOverrides
            key={buildingId}
            initialView={overrideView}
            buildingId={buildingId}
            planLabels={planLabels}
          />
        ) : (
          <div className={cx("console")}>
            <div className={cx("empty")}>
              <h4>{t("comingSoon.title")}</h4>
              <p>{t("comingSoon.buildings")}</p>
            </div>
          </div>
        ))}
    </div>
  );
}
