"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createUnit, updateUnit } from "@/app/actions/units";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

interface UnitData {
  id: string;
  number: string;
  floor: number;
  stairwell: string | null;
  positionOnFloor: number | null;
  size: number;
  ownershipShare: number;
}

interface Props {
  open: boolean;
  unit: UnitData | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UnitModal({ open, unit, onClose, onSaved }: Props) {
  const t = useTranslations("units");
  const tCommon = useTranslations("common");
  const isEdit = !!unit;

  const [number, setNumber] = useState("");
  const [stairwell, setStairwell] = useState("");
  const [floor, setFloor] = useState("");
  const [positionOnFloor, setPositionOnFloor] = useState("");
  const [size, setSize] = useState("");
  const [ownershipShare, setOwnershipShare] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync incoming unit when the modal opens.
  useEffect(() => {
    if (!open) return;
    setNumber(unit?.number ?? "");
    setStairwell(unit?.stairwell ?? "");
    setFloor(unit?.floor != null ? String(unit.floor) : "");
    setPositionOnFloor(
      unit?.positionOnFloor != null ? String(unit.positionOnFloor) : "",
    );
    setSize(unit?.size != null ? String(unit.size) : "");
    setOwnershipShare(
      unit?.ownershipShare != null ? String(unit.ownershipShare) : "",
    );
    setErrors({});
  }, [open, unit]);

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!number.trim()) errs.number = t("modal.required");
    if (floor === "" || Number.isNaN(parseInt(floor, 10))) {
      errs.floor = t("modal.required");
    }
    if (!size || parseFloat(size) <= 0) {
      errs.size = t("modal.positiveSize");
    }
    if (!ownershipShare) {
      errs.ownershipShare = t("modal.required");
    } else {
      const v = parseFloat(ownershipShare);
      if (Number.isNaN(v) || v < 0 || v > 1) {
        errs.ownershipShare = t("modal.shareRange");
      }
    }
    if (positionOnFloor) {
      const p = parseInt(positionOnFloor, 10);
      if (Number.isNaN(p) || p < 1 || p > 20) {
        errs.positionOnFloor = t("modal.positionRange");
      }
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const input = {
        number: number.trim(),
        floor: parseInt(floor, 10),
        stairwell: stairwell.trim() || null,
        positionOnFloor: positionOnFloor ? parseInt(positionOnFloor, 10) : null,
        size: parseFloat(size),
        ownershipShare: parseFloat(ownershipShare),
      };
      const result = isEdit
        ? await updateUnit(unit.id, input)
        : await createUnit(input);
      if (result.error) {
        setErrors({ submit: result.error });
        return;
      }
      toast.success(isEdit ? t("modal.updated") : t("modal.created"));
      onSaved();
    } catch {
      const msg = tCommon("error");
      setErrors({ submit: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VotingModalShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? t("modal.editEyebrow") : t("modal.createEyebrow")}
      title={isEdit ? t("editUnit") : t("addUnit")}
      subtitle={t("modal.subtitle")}
      accent="moss"
      maxWidth={520}
    >
      <form
        onSubmit={handleSubmit}
        style={{ padding: "0 24px 22px", overflowY: "auto", flex: 1 }}
      >
        {errors.submit && (
          <div
            role="alert"
            className="mb-4"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {errors.submit}
          </div>
        )}

        <VotingField
          label={t("unitNumber")}
          htmlFor="unit-number"
          error={errors.number}
        >
          <input
            id="unit-number"
            type="text"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              clearError("number");
            }}
            placeholder={t("modal.numberPlaceholder")}
            style={votingInputStyle(!!errors.number)}
          />
        </VotingField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <VotingField
            label={t("modal.stairwellLabel")}
            htmlFor="unit-stairwell"
            hint={t("modal.stairwellHint")}
          >
            <input
              id="unit-stairwell"
              type="text"
              maxLength={2}
              value={stairwell}
              onChange={(e) => setStairwell(e.target.value.toUpperCase())}
              placeholder="A"
              style={{
                ...votingInputStyle(false),
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 600,
                textAlign: "center",
              }}
            />
          </VotingField>
          <VotingField
            label={t("floor")}
            htmlFor="unit-floor"
            error={errors.floor}
          >
            <input
              id="unit-floor"
              type="number"
              min="0"
              max="50"
              value={floor}
              onChange={(e) => {
                setFloor(e.target.value);
                clearError("floor");
              }}
              placeholder="1"
              style={votingInputStyle(!!errors.floor)}
            />
          </VotingField>
          <VotingField
            label={t("modal.positionLabel")}
            htmlFor="unit-position"
            error={errors.positionOnFloor}
            hint={t("modal.positionHint")}
          >
            <input
              id="unit-position"
              type="number"
              min="1"
              max="20"
              value={positionOnFloor}
              onChange={(e) => {
                setPositionOnFloor(e.target.value);
                clearError("positionOnFloor");
              }}
              placeholder="1"
              style={votingInputStyle(!!errors.positionOnFloor)}
            />
          </VotingField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VotingField
            label={t("size")}
            htmlFor="unit-size"
            error={errors.size}
          >
            <div className="relative">
              <input
                id="unit-size"
                type="number"
                step="0.1"
                min="0"
                value={size}
                onChange={(e) => {
                  setSize(e.target.value);
                  clearError("size");
                }}
                placeholder="65.5"
                style={{
                  ...votingInputStyle(!!errors.size),
                  paddingRight: "44px",
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                }}
              />
              <span
                className="absolute font-mono pointer-events-none"
                style={{
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                m²
              </span>
            </div>
          </VotingField>
          <VotingField
            label={t("ownershipShare")}
            htmlFor="unit-share"
            error={errors.ownershipShare}
            hint={t("modal.shareHint")}
          >
            <input
              id="unit-share"
              type="number"
              step="0.0001"
              min="0"
              max="1"
              value={ownershipShare}
              onChange={(e) => {
                setOwnershipShare(e.target.value);
                clearError("ownershipShare");
              }}
              placeholder="0.0125"
              style={{
                ...votingInputStyle(!!errors.ownershipShare),
                fontFamily: "var(--font-ibm-plex-mono), monospace",
              }}
            />
          </VotingField>
        </div>

        <div
          className="flex justify-end items-center gap-2"
          style={{
            marginTop: "22px",
            paddingTop: "16px",
            borderTop:
              "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-card)",
              color: "var(--color-ink-soft)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: "1px solid var(--color-ink)",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting
              ? tCommon("loading")
              : isEdit
                ? t("modal.saveCta")
                : t("modal.createCta")}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}
