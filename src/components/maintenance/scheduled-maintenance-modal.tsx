"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ScheduledMaintenanceModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePreset, setRecurrencePreset] = useState<string>("12");
  const [customMonths, setCustomMonths] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function reset() {
    setTitle("");
    setDescription("");
    setDate("");
    setIsRecurring(false);
    setRecurrencePreset("12");
    setCustomMonths("");
    setLeadTimeDays("7");
    setErrors({});
  }

  function resolveRecurrenceMonths(): number | null {
    if (!isRecurring) return null;
    if (recurrencePreset === "custom") {
      const n = parseInt(customMonths, 10);
      return Number.isInteger(n) && n >= 1 && n <= 60 ? n : NaN as never;
    }
    const n = parseInt(recurrencePreset, 10);
    return Number.isInteger(n) ? n : null;
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("missingFields");
    if (!date) errs.date = t("missingFields");
    if (isRecurring) {
      const m = resolveRecurrenceMonths();
      if (typeof m !== "number" || Number.isNaN(m) || m < 1 || m > 60) {
        errs.recurrenceMonths = t("scheduled.modal.recurrenceMonthsRange");
      }
    }
    const lt = parseInt(leadTimeDays, 10);
    if (Number.isNaN(lt) || lt < 0 || lt > 365) {
      errs.leadTimeDays = t("scheduled.modal.leadTimeRange");
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
      const res = await fetch("/api/maintenance/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          date,
          isRecurring,
          recurrenceMonths: resolveRecurrenceMonths(),
          leadTimeDays: parseInt(leadTimeDays, 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || tCommon("error") });
        return;
      }
      toast.success(t("scheduled.entryCreated"));
      reset();
      onCreated();
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
      onClose={() => {
        reset();
        onClose();
      }}
      eyebrow={t("scheduled.modal.eyebrow")}
      title={t("scheduled.addEntry")}
      subtitle={t("scheduled.modal.subtitle")}
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
              background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {errors.submit}
          </div>
        )}

        <VotingField
          label={t("scheduled.titleLabel")}
          htmlFor="sched-title"
          error={errors.title}
        >
          <input
            id="sched-title"
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("title");
            }}
            placeholder={t("scheduled.modal.titlePlaceholder")}
            style={votingInputStyle(!!errors.title)}
          />
        </VotingField>

        <VotingField
          label={t("scheduled.descriptionLabel")}
          htmlFor="sched-description"
        >
          <textarea
            id="sched-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("scheduled.modal.descriptionPlaceholder")}
            style={{
              ...votingInputStyle(false),
              resize: "vertical",
              minHeight: "70px",
            }}
          />
        </VotingField>

        <VotingField
          label={t("scheduled.date")}
          htmlFor="sched-date"
          error={errors.date}
        >
          <input
            id="sched-date"
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              clearError("date");
            }}
            style={votingInputStyle(!!errors.date)}
          />
        </VotingField>

        <label
          className="flex items-start gap-2.5"
          style={{
            padding: "10px 12px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            borderRadius: "8px",
            marginBottom: "14px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            style={{
              accentColor: "var(--color-moss-2)",
              width: "16px",
              height: "16px",
              marginTop: "2px",
              flexShrink: 0,
            }}
          />
          <span>
            <span style={{ display: "block", fontWeight: 600 }}>
              {t("scheduled.isRecurring")}
            </span>
            <span
              style={{
                display: "block",
                fontSize: "11.5px",
                color: "var(--color-ink-soft)",
                marginTop: "2px",
              }}
            >
              {t("scheduled.modal.recurringHint")}
            </span>
          </span>
        </label>

        {isRecurring && (
          <VotingField
            label={t("scheduled.modal.recurrenceLabel")}
            htmlFor="sched-recurrence"
            error={errors.recurrenceMonths}
            hint={t("scheduled.modal.recurrenceHint")}
          >
            <select
              id="sched-recurrence"
              value={recurrencePreset}
              onChange={(e) => {
                setRecurrencePreset(e.target.value);
                clearError("recurrenceMonths");
              }}
              style={votingInputStyle(!!errors.recurrenceMonths)}
            >
              <option value="1">{t("scheduled.modal.preset_1")}</option>
              <option value="3">{t("scheduled.modal.preset_3")}</option>
              <option value="6">{t("scheduled.modal.preset_6")}</option>
              <option value="12">{t("scheduled.modal.preset_12")}</option>
              <option value="24">{t("scheduled.modal.preset_24")}</option>
              <option value="custom">{t("scheduled.modal.preset_custom")}</option>
            </select>
            {recurrencePreset === "custom" && (
              <div className="relative" style={{ marginTop: "8px" }}>
                <input
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  value={customMonths}
                  onChange={(e) => {
                    setCustomMonths(e.target.value);
                    clearError("recurrenceMonths");
                  }}
                  placeholder="6"
                  style={{
                    ...votingInputStyle(!!errors.recurrenceMonths),
                    paddingRight: "60px",
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
                  {t("scheduled.modal.monthsUnit")}
                </span>
              </div>
            )}
          </VotingField>
        )}

        <VotingField
          label={t("scheduled.modal.leadTimeLabel")}
          htmlFor="sched-lead-time"
          error={errors.leadTimeDays}
          hint={t("scheduled.modal.leadTimeHint")}
        >
          <div className="relative">
            <input
              id="sched-lead-time"
              type="number"
              min="0"
              max="365"
              step="1"
              value={leadTimeDays}
              onChange={(e) => {
                setLeadTimeDays(e.target.value);
                clearError("leadTimeDays");
              }}
              style={{
                ...votingInputStyle(!!errors.leadTimeDays),
                paddingRight: "56px",
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
              {t("scheduled.modal.daysUnit")}
            </span>
          </div>
        </VotingField>

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
            onClick={() => {
              reset();
              onClose();
            }}
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
            {submitting ? (
              <>
                <Spinner /> {tCommon("loading")}
              </>
            ) : (
              <>
                <PlusIcon /> {t("scheduled.addEntry")}
              </>
            )}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
