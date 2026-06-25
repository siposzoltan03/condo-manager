"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createTicket } from "@/app/actions/maintenance";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

const CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "COMMON_AREA",
  "ELEVATOR",
  "HEATING",
  "OTHER",
] as const;

const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** Default SLA (hours) suggested per urgency — editable in the form. */
const SLA_DEFAULTS: Record<(typeof URGENCIES)[number], number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function ReportIssueModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [urgency, setUrgency] = useState<string>("");
  const [location, setLocation] = useState("");
  const [slaHours, setSlaHours] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successTracking, setSuccessTracking] = useState<string | null>(null);

  // Auto-prefill SLA when urgency changes (only if user hasn't custom-edited).
  const [slaTouched, setSlaTouched] = useState(false);
  useEffect(() => {
    if (slaTouched) return;
    if (urgency && URGENCIES.includes(urgency as (typeof URGENCIES)[number])) {
      setSlaHours(String(SLA_DEFAULTS[urgency as (typeof URGENCIES)[number]]));
    }
  }, [urgency, slaTouched]);

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
    setCategory("");
    setUrgency("");
    setLocation("");
    setSlaHours("");
    setSlaTouched(false);
    setErrors({});
    setSuccessTracking(null);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("missingFields");
    if (!description.trim()) errs.description = t("missingFields");
    if (!category) errs.category = t("missingFields");
    if (!urgency) errs.urgency = t("missingFields");
    if (slaHours) {
      const n = parseInt(slaHours, 10);
      if (Number.isNaN(n) || n < 1 || n > 720) {
        errs.slaHours = t("modal.slaRange");
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
      const result = await createTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        urgency,
        location: location.trim() || undefined,
        slaHours: slaHours ? parseInt(slaHours, 10) : null,
      });

      if (result.error) {
        setErrors({ submit: result.error });
        return;
      }
      toast.success(t("ticketCreated"));
      setSuccessTracking(result.trackingNumber ?? "");
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
        if (successTracking) {
          // Treat closing the success view as "done"
          reset();
          onCreated();
        } else {
          reset();
          onClose();
        }
      }}
      eyebrow={t("modal.eyebrow")}
      title={successTracking ? t("ticketCreated") : t("reportIssue")}
      subtitle={successTracking ? undefined : t("modal.subtitle")}
      accent="ochre"
      maxWidth={560}
    >
      {successTracking ? (
        <div
          style={{
            padding: "8px 24px 22px",
            textAlign: "center",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <div
            className="grid place-items-center mx-auto"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--color-good-soft)",
              color: "var(--color-good)",
              marginBottom: "16px",
              marginTop: "12px",
            }}
          >
            <CheckIcon />
          </div>
          <p
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            {t("trackingNumber")}
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              marginBottom: "20px",
            }}
          >
            {successTracking}
          </p>
          <button
            type="button"
            onClick={() => {
              reset();
              onCreated();
            }}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: "1px solid var(--color-ink)",
              cursor: "pointer",
            }}
          >
            {t("modal.successCta")}
          </button>
        </div>
      ) : (
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
            label={t("ticketTitle")}
            htmlFor="ticket-title"
            error={errors.title}
          >
            <input
              id="ticket-title"
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError("title");
              }}
              placeholder={t("modal.titlePlaceholder")}
              style={votingInputStyle(!!errors.title)}
            />
          </VotingField>

          <VotingField
            label={t("description")}
            htmlFor="ticket-description"
            error={errors.description}
          >
            <textarea
              id="ticket-description"
              required
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              rows={4}
              placeholder={t("descriptionPlaceholder")}
              style={{
                ...votingInputStyle(!!errors.description),
                resize: "vertical",
                minHeight: "90px",
              }}
            />
          </VotingField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <VotingField
              label={t("categoryLabel")}
              htmlFor="ticket-category"
              error={errors.category}
            >
              <select
                id="ticket-category"
                required
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  clearError("category");
                }}
                style={votingInputStyle(!!errors.category)}
              >
                <option value="">{t("selectCategory")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`category.${c}`)}
                  </option>
                ))}
              </select>
            </VotingField>

            <VotingField
              label={t("urgencyLabel")}
              htmlFor="ticket-urgency"
              error={errors.urgency}
            >
              <select
                id="ticket-urgency"
                required
                value={urgency}
                onChange={(e) => {
                  setUrgency(e.target.value);
                  clearError("urgency");
                }}
                style={votingInputStyle(!!errors.urgency)}
              >
                <option value="">{t("selectUrgency")}</option>
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {t(`urgency.${u}`)}
                  </option>
                ))}
              </select>
            </VotingField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <VotingField label={t("location")} htmlFor="ticket-location">
              <input
                id="ticket-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("locationPlaceholder")}
                style={votingInputStyle(false)}
              />
            </VotingField>

            <VotingField
              label={t("modal.slaLabel")}
              htmlFor="ticket-sla"
              hint={
                urgency
                  ? t("modal.slaHint", {
                      urgency: t(`urgency.${urgency}`),
                      hours: SLA_DEFAULTS[
                        urgency as (typeof URGENCIES)[number]
                      ]?.toString() ?? "—",
                    })
                  : t("modal.slaHintGeneric")
              }
              error={errors.slaHours}
            >
              <div className="relative">
                <input
                  id="ticket-sla"
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  value={slaHours}
                  onChange={(e) => {
                    setSlaHours(e.target.value);
                    setSlaTouched(true);
                    clearError("slaHours");
                  }}
                  placeholder="24"
                  style={{
                    ...votingInputStyle(!!errors.slaHours),
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
                  Ó
                </span>
              </div>
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
                border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
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
                  <PlusIcon /> {t("submit")}
                </>
              )}
            </button>
          </div>
        </form>
      )}
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

function CheckIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
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
