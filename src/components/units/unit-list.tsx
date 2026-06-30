"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Percent, Ruler, AlertTriangle } from "lucide-react";
import { AddUnitButton, EditUnitButton } from "./unit-actions";
import { DeleteUnitButton } from "./unit-delete-button";
import { ImportUnitsButton } from "./import-units-button";
import type { UnitsData } from "@/lib/dal";

interface UnitListProps {
  initialData: UnitsData;
}

export function UnitList({ initialData }: UnitListProps) {
  const t = useTranslations("common");
  const tUnits = useTranslations("units");
  const [displayMode, setDisplayMode] = useState<"decimal" | "percent">("percent");

  const { units, totalOwnershipShare } = initialData;

  const averageSize =
    units.length > 0
      ? units.reduce((sum, u) => sum + u.size, 0) / units.length
      : 0;

  const isOwnershipOk = Math.abs(totalOwnershipShare - 1) < 0.0001;
  const isOwnershipOver = totalOwnershipShare > 1.0001;

  const ownershipColor = isOwnershipOver
    ? "text-danger"
    : isOwnershipOk
      ? "text-good"
      : "text-ochre";

  function formatOwnership(value: number): string {
    if (displayMode === "percent") {
      return `${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(4);
  }

  function formatTotalOwnership(value: number): string {
    if (displayMode === "percent") {
      return `${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(4);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-blue">
            {tUnits("title")}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ImportUnitsButton />
          <AddUnitButton totalOwnershipShare={totalOwnershipShare} />
        </div>
      </div>

      {/* Summary Cards */}
      {units.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Total Units */}
          <div className="flex items-center gap-5 rounded-xl bg-card p-6 shadow-sm border border-tile-a">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue/10">
              <Building2 className="h-6 w-6 text-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted">{tUnits("totalUnits")}</p>
              <p className="text-2xl font-extrabold text-blue">{units.length}</p>
            </div>
          </div>

          {/* Total Ownership */}
          <div
            className={`flex items-center gap-5 rounded-xl p-6 shadow-sm border border-tile-a ${
              isOwnershipOver
                ? "bg-danger/10"
                : isOwnershipOk
                  ? "bg-good/10"
                  : "bg-ochre/15"
            }`}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card/20">
              <Percent className={`h-6 w-6 ${ownershipColor}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${ownershipColor}`}>
                {tUnits("totalOwnership")}
              </p>
              <p className={`text-2xl font-extrabold ${ownershipColor}`}>
                {formatTotalOwnership(totalOwnershipShare)}
              </p>
            </div>
          </div>

          {/* Average Size */}
          <div className="flex items-center gap-5 rounded-xl bg-card p-6 shadow-sm border border-tile-a">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue/10">
              <Ruler className="h-6 w-6 text-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted">{tUnits("averageSize")}</p>
              <p className="text-2xl font-extrabold text-blue">
                {averageSize.toFixed(1)} m&sup2;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Warning Banner */}
      {units.length > 0 && !isOwnershipOk && (
        <div
          className={`flex items-center gap-3 rounded-xl px-6 py-4 shadow-sm font-semibold ${
            isOwnershipOver
              ? "bg-danger/10 text-danger"
              : "bg-ochre/15 text-ochre"
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {isOwnershipOver ? tUnits("ownershipOver") : tUnits("ownershipWarning")}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-card shadow-sm border border-tile-a">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-bg-3 border-b border-tile-a">
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">
                  {tUnits("unitNumber")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">
                  {tUnits("floor")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">
                  {tUnits("size")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>{tUnits("ownershipShare")}</span>
                    <div className="inline-flex rounded-lg border border-tile-a bg-card text-[10px] font-bold">
                      <button
                        onClick={() => setDisplayMode("percent")}
                        className={`rounded-l-lg px-2 py-0.5 transition-colors ${
                          displayMode === "percent"
                            ? "bg-blue text-card"
                            : "text-muted hover:bg-bg-3"
                        }`}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setDisplayMode("decimal")}
                        className={`rounded-r-lg px-2 py-0.5 transition-colors ${
                          displayMode === "decimal"
                            ? "bg-blue text-card"
                            : "text-muted hover:bg-bg-3"
                        }`}
                      >
                        0.00
                      </button>
                    </div>
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">
                  {tUnits("primaryContact")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">
                  {tUnits("residents")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">
                  {t("edit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tile-a">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">
                    {tUnits("noUnits")}
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-blue/10 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center justify-center rounded-lg bg-blue/10 px-3 py-1 text-sm font-bold text-blue">
                        {unit.number}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-medium text-ink">
                      {unit.floor}
                    </td>
                    <td className="px-6 py-5 text-ink">
                      {unit.size.toFixed(1)} m&sup2;
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <span className="text-sm font-bold text-blue tabular-nums">
                          {formatOwnership(unit.ownershipShare)}
                        </span>
                        <div className="w-full h-1 rounded-full bg-blue/10 overflow-hidden">
                          <div
                            className="h-full bg-blue rounded-full"
                            style={{ width: `${Math.min(unit.ownershipShare * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-medium text-ink">
                      {unit.primaryContact ?? (
                        <span className="text-muted italic">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-bold text-muted">
                        {unit.residentCount}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <EditUnitButton
                          unit={unit}
                          totalOwnershipShare={totalOwnershipShare}
                        />
                        <DeleteUnitButton
                          unitId={unit.id}
                          hasUsers={unit.residentCount > 0}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
