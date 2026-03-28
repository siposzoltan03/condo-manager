"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useBuilding } from "@/hooks/use-building";
import { Building, ChevronDown, Check } from "lucide-react";

export function BuildingSwitcher() {
  const t = useTranslations("building");
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { activeBuildingId, buildings, hasMultipleBuildings } = useBuilding();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitch(buildingId: string) {
    if (buildingId === activeBuildingId || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/buildings/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update the JWT session with new building context
        await updateSession({
          activeBuildingId: data.buildingId,
          activeRole: data.role,
        });
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  if (!activeBuilding) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => hasMultipleBuildings && setOpen(!open)}
        className={`flex w-full items-center gap-3 px-6 py-5 text-left transition-colors ${
          hasMultipleBuildings
            ? "cursor-pointer hover:bg-slate-700/50"
            : "cursor-default"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Building className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">
            {activeBuilding.name}
          </p>
          <p className="truncate text-xs text-slate-400">
            {t(`role_${activeBuilding.role}`)}
          </p>
        </div>
        {hasMultipleBuildings && (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {open && hasMultipleBuildings && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-lg border border-slate-600 bg-slate-700 py-1 shadow-xl">
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            {t("switchBuilding")}
          </p>
          {buildings.map((building) => {
            const isActive = building.id === activeBuildingId;
            return (
              <button
                key={building.id}
                type="button"
                onClick={() => handleSwitch(building.id)}
                disabled={switching}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-white"
                    : "text-slate-300 hover:bg-slate-600 hover:text-white"
                } ${switching ? "opacity-50" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {building.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t(`role_${building.role}`)}
                  </p>
                </div>
                {isActive && (
                  <Check className="h-4 w-4 shrink-0 text-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
