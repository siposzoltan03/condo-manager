import { useTranslations } from "next-intl";
import { Building2, Percent, Ruler, AlertTriangle } from "lucide-react";
import { AddUnitButton, EditUnitButton } from "./unit-actions";
import { DeleteUnitButton } from "./unit-delete-button";
import type { UnitsData } from "@/lib/dal";

interface UnitListProps {
  initialData: UnitsData;
}

export function UnitList({ initialData }: UnitListProps) {
  const t = useTranslations("common");
  const tUnits = useTranslations("units");

  const { units, totalOwnershipShare } = initialData;

  const averageSize =
    units.length > 0
      ? units.reduce((sum, u) => sum + u.size, 0) / units.length
      : 0;

  const isOwnershipOk = Math.abs(totalOwnershipShare - 1) < 0.0001;
  const isOwnershipOver = totalOwnershipShare > 1.0001;

  const ownershipColor = isOwnershipOver
    ? "text-[#93000a]"
    : isOwnershipOk
      ? "text-emerald-600"
      : "text-[#633f0f]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-manrope text-3xl font-extrabold tracking-tight text-[#002045]">
            {tUnits("title")}
          </h1>
        </div>
        <AddUnitButton totalOwnershipShare={totalOwnershipShare} />
      </div>

      {/* Summary Cards */}
      {units.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Total Units */}
          <div className="flex items-center gap-5 rounded-xl bg-white p-6 shadow-sm border border-[#c4c6cf]/20">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e2e7ff]">
              <Building2 className="h-6 w-6 text-[#002045]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#515f74]">{tUnits("totalUnits")}</p>
              <p className="text-2xl font-extrabold text-[#002045]">{units.length}</p>
            </div>
          </div>

          {/* Total Ownership */}
          <div
            className={`flex items-center gap-5 rounded-xl p-6 shadow-sm border border-[#c4c6cf]/20 ${
              isOwnershipOver
                ? "bg-[#ffdad6]"
                : isOwnershipOk
                  ? "bg-emerald-50"
                  : "bg-[#ffddba]"
            }`}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Percent className={`h-6 w-6 ${ownershipColor}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${ownershipColor}`}>
                {tUnits("totalOwnership")}
              </p>
              <p className={`text-2xl font-extrabold ${ownershipColor}`}>
                {totalOwnershipShare.toFixed(4)}
              </p>
            </div>
          </div>

          {/* Average Size */}
          <div className="flex items-center gap-5 rounded-xl bg-white p-6 shadow-sm border border-[#c4c6cf]/20">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e2e7ff]">
              <Ruler className="h-6 w-6 text-[#002045]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#515f74]">{tUnits("averageSize")}</p>
              <p className="text-2xl font-extrabold text-[#002045]">
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
              ? "bg-[#ffdad6] text-[#93000a]"
              : "bg-[#ffddba] text-[#633f0f]"
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {isOwnershipOver ? tUnits("ownershipOver") : tUnits("ownershipWarning")}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-[#c4c6cf]/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-[#f2f3ff] border-b border-[#c4c6cf]/10">
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider">
                  {tUnits("unitNumber")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider">
                  {tUnits("floor")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider">
                  {tUnits("size")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider">
                  {tUnits("ownershipShare")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider">
                  {tUnits("primaryContact")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider">
                  {tUnits("residents")}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#515f74] uppercase tracking-wider text-right">
                  {t("edit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6cf]/10">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#515f74]">
                    {tUnits("noUnits")}
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-[#eaedff]/30 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center justify-center rounded-lg bg-[#d6e3ff] px-3 py-1 text-sm font-bold text-[#001b3c]">
                        {unit.number}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-medium text-[#131b2e]">
                      {unit.floor}
                    </td>
                    <td className="px-6 py-5 text-[#131b2e]">
                      {unit.size.toFixed(1)} m&sup2;
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <span className="text-sm font-bold text-[#002045] tabular-nums">
                          {unit.ownershipShare.toFixed(4)}
                        </span>
                        <div className="w-full h-1 rounded-full bg-[#eaedff] overflow-hidden">
                          <div
                            className="h-full bg-[#002045] rounded-full"
                            style={{ width: `${Math.min(unit.ownershipShare * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-medium text-[#131b2e]">
                      {unit.primaryContact ?? (
                        <span className="text-[#515f74] italic">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center rounded-full bg-[#e2e7ff] px-2.5 py-0.5 text-xs font-bold text-[#515f74]">
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
