"use client";

import { useTranslations } from "next-intl";
import { X, ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredPlan: string;
  currentPlan: string;
}

const PLAN_DISPLAY: Record<string, string> = {
  starter: "planStarter",
  pro: "planPro",
  enterprise: "planEnterprise",
  legacy: "planLegacy",
};

export function UpgradeModal({
  isOpen,
  onClose,
  featureName,
  requiredPlan,
  currentPlan,
}: Props) {
  const t = useTranslations("featureGate");

  if (!isOpen) return null;

  const requiredPlanKey = PLAN_DISPLAY[requiredPlan] ?? "planPro";
  const currentPlanKey = PLAN_DISPLAY[currentPlan] ?? "planStarter";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 mb-4">
            <Sparkles className="h-7 w-7 text-amber-500" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {t("upgradeTitle")}
          </h2>

          <p className="text-sm text-slate-600 mb-2">
            {t("upgradeDescription")}
          </p>

          <p className="text-sm font-medium text-slate-900 mb-1">
            {featureName}
          </p>

          <p className="text-xs text-slate-500 mb-1">
            {t("availableOn", { plan: t(requiredPlanKey) })}
          </p>

          <p className="text-xs text-slate-400 mb-6">
            {t("currentPlan", { plan: t(currentPlanKey) })}
          </p>

          <div className="flex w-full gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("dismiss")}
            </button>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {t("upgradeButton")}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
