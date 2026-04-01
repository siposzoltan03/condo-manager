"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Info } from "lucide-react";
import { createUnit, updateUnit } from "@/app/actions/units";

interface UnitData {
  id: string;
  number: string;
  floor: number;
  size: number;
  ownershipShare: number;
}

interface UnitFormModalProps {
  unit: UnitData | null; // null = create mode
  totalOwnershipShare: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnitFormModal({
  unit,
  totalOwnershipShare,
  onClose,
  onSuccess,
}: UnitFormModalProps) {
  const t = useTranslations("common");
  const tUnits = useTranslations("units");
  const isEdit = !!unit;

  const [number, setNumber] = useState(unit?.number ?? "");
  const [floor, setFloor] = useState(unit?.floor?.toString() ?? "");
  const [size, setSize] = useState(unit?.size?.toString() ?? "");
  const [ownershipShare, setOwnershipShare] = useState(
    unit ? unit.ownershipShare.toString() : ""
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const shareValue = parseFloat(ownershipShare) || 0;
  const currentTotalExcluding = isEdit
    ? totalOwnershipShare - unit.ownershipShare
    : totalOwnershipShare;
  const projectedTotal = currentTotalExcluding + shareValue;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (!number || floor === "" || !size || !ownershipShare) {
      setError("All fields are required");
      setSubmitting(false);
      return;
    }

    if (shareValue < 0 || shareValue > 1) {
      setError("Ownership share must be between 0 and 1");
      setSubmitting(false);
      return;
    }

    try {
      const input = {
        number,
        floor: Number(floor),
        size: Number(size),
        ownershipShare: shareValue,
      };

      const result = isEdit
        ? await updateUnit(unit.id, input)
        : await createUnit(input);

      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      setSuccess(isEdit ? "Unit updated successfully" : "Unit created successfully");
      setTimeout(onSuccess, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 bg-[#f2f3ff] border border-[#c4c6cf]/40 rounded-lg text-sm text-[#131b2e] placeholder:text-[#74777f] outline-none focus:ring-2 focus:ring-[#002045] focus:border-[#002045] transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl mx-4 overflow-hidden border border-[#c4c6cf]/20">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#c4c6cf]/10">
          <h2 className="text-xl font-bold font-manrope text-[#131b2e] tracking-tight">
            {isEdit ? tUnits("editUnit") : tUnits("addUnit")}
          </h2>
          <button
            onClick={onClose}
            className="text-[#43474e] hover:text-[#131b2e] transition-colors p-1"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit}>
          <div className="px-8 py-8 space-y-6">
            {/* Unit Number */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#43474e]">
                {tUnits("unitNumber")}
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                className={inputClass}
                placeholder={tUnits("numberPlaceholder")}
              />
            </div>

            {/* Floor */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#43474e]">
                {tUnits("floor")}
              </label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                required
                className={inputClass}
                placeholder={tUnits("floorPlaceholder")}
              />
            </div>

            {/* Size */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#43474e]">
                {tUnits("size")}
              </label>
              <input
                type="number"
                step="0.1"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                required
                className={inputClass}
                placeholder={tUnits("sizePlaceholder")}
              />
            </div>

            {/* Ownership Share */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#43474e]">
                {tUnits("ownershipPercent")}
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                value={ownershipShare}
                onChange={(e) => setOwnershipShare(e.target.value)}
                required
                className={inputClass}
                placeholder={tUnits("ownershipPlaceholder")}
              />
            </div>

            {/* Ownership info box */}
            {shareValue > 0 && (
              <div
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  projectedTotal > 1.0001
                    ? "bg-[#ffdad6]/50 border-[#ffdad6] text-[#93000a]"
                    : projectedTotal < 0.9999
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">
                  {tUnits("currentTotal")}: {currentTotalExcluding.toFixed(4)}
                  {" / "}
                  {tUnits("afterAdding")}: {projectedTotal.toFixed(4)}
                </p>
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <div className="rounded-lg bg-[#ffdad6] px-4 py-3 text-sm font-medium text-[#93000a]">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {success}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-8 py-6 bg-[#f2f3ff]/50 border-t border-[#c4c6cf]/10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-[#43474e] hover:text-[#131b2e] transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#1a365d] px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow-md disabled:opacity-50 transition-all active:opacity-90"
            >
              {submitting ? t("loading") : isEdit ? t("save") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
