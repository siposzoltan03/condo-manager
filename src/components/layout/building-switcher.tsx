"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useBuilding } from "@/hooks/use-building";
import { Check } from "lucide-react";

export function BuildingSwitcher() {
  const t = useTranslations("building");
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { activeBuildingId, buildings, hasMultipleBuildings } = useBuilding();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);

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

  if (!activeBuilding) return null;

  const initials = activeBuilding.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => hasMultipleBuildings && setOpen(!open)}
        className="flex w-full items-center gap-2.5 transition-colors"
        style={{
          padding: "10px 12px",
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "10px",
          cursor: hasMultipleBuildings ? "pointer" : "default",
        }}
      >
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "7px",
            background: "var(--color-moss)",
            color: "#f5f2e6",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <strong
            className="block truncate"
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "-0.015em",
            }}
          >
            {activeBuilding.name}
          </strong>
          <small
            className="block font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {t(`role_${activeBuilding.role}`)}
          </small>
        </div>
        {hasMultipleBuildings && (
          <span
            className="font-mono flex-shrink-0"
            style={{
              fontSize: "14px",
              color: "var(--color-muted)",
              transform: open ? "rotate(180deg)" : undefined,
              transition: "transform 0.15s",
            }}
          >
            ⌄
          </span>
        )}
      </button>

      {open && hasMultipleBuildings && (
        <div
          className="absolute left-0 right-0 z-50 overflow-hidden"
          style={{
            top: "calc(100% + 4px)",
            background: "var(--color-card)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "10px",
            boxShadow:
              "0 16px 40px -12px color-mix(in srgb, var(--color-ink) 25%, transparent)",
          }}
        >
          <p
            className="font-mono"
            style={{
              padding: "10px 12px 6px",
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {t("switchBuilding")}
          </p>
          {buildings.map((b) => {
            const isActive = b.id === activeBuildingId;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSwitch(b.id)}
                disabled={switching}
                className="flex w-full items-center gap-2.5 transition-colors disabled:opacity-50"
                style={{
                  padding: "10px 12px",
                  background: isActive
                    ? "color-mix(in srgb, var(--color-ink) 5%, transparent)"
                    : "transparent",
                  textAlign: "left",
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {b.name}
                  </p>
                  <p
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t(`role_${b.role}`)}
                  </p>
                </div>
                {isActive && (
                  <Check
                    className="flex-shrink-0"
                    style={{ width: "14px", height: "14px", color: "var(--color-moss)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
