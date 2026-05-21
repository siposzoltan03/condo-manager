"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { VotingModalShell } from "@/components/voting/voting-modal-shell";
import { LeadCard, type LeadCardData } from "./lead-card";
import { SPECIALTIES } from "@/lib/contractor/taxonomy";
import {
  BUDGET_BANDS,
  PUBLICATION_URGENCIES,
  defaultPublicationUrgency,
  defaultSpecialtyForCategory,
  type BudgetBand,
  type PublicationUrgency,
} from "@/lib/marketplace/category-mapping";

interface TicketSeed {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  zip: string;
  publisherDisplayName: string;
  defaultContactEmail: string;
}

type Step = 1 | 2 | 3;

export function PublishWizard({
  open,
  onClose,
  ticket,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  ticket: TicketSeed;
  onPublished: (publicationId: string) => void;
}) {
  const t = useTranslations("marketplace");
  const locale = useLocale() as "hu" | "en";

  const [step, setStep] = useState<Step>(1);
  const [scrubbedTitle, setScrubbedTitle] = useState(ticket.title);
  const [scrubbedDescription, setScrubbedDescription] = useState(
    ticket.description,
  );
  const [specialties, setSpecialties] = useState<string[]>([
    defaultSpecialtyForCategory(ticket.category),
  ]);
  const [urgency, setUrgency] = useState<PublicationUrgency>(
    defaultPublicationUrgency(ticket.urgency),
  );
  const [budgetBand, setBudgetBand] = useState<BudgetBand | null>(null);
  const [deadlinePreset, setDeadlinePreset] = useState<"48h" | "7d" | "14d">(
    "14d",
  );
  const [revealAddress, setRevealAddress] = useState(true);
  const [revealUnit, setRevealUnit] = useState(false);
  const [revealOwnerPhone, setRevealOwnerPhone] = useState(false);
  const [contactEmail, setContactEmail] = useState(ticket.defaultContactEmail);
  const [contactPhone, setContactPhone] = useState("");
  const [attest, setAttest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset every time the modal re-opens so a stale draft doesn't leak.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setAttest(false);
    setSubmitting(false);
  }, [open]);

  const deadlineAt = useMemo(() => {
    const ms =
      deadlinePreset === "48h"
        ? 48 * 60 * 60 * 1000
        : deadlinePreset === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 14 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }, [deadlinePreset]);

  const previewData = useMemo<LeadCardData>(
    () => ({
      scrubbedTitle,
      scrubbedDescription,
      category: ticket.category,
      urgency,
      city: ticket.city,
      zip: ticket.zip,
      budgetBand,
      deadlineAt,
      publishedAt: null,
      publisherDisplayName: ticket.publisherDisplayName,
      bidsCount: 0,
    }),
    [
      scrubbedTitle,
      scrubbedDescription,
      ticket.category,
      urgency,
      ticket.city,
      ticket.zip,
      budgetBand,
      deadlineAt,
      ticket.publisherDisplayName,
    ],
  );

  function toggleSpecialty(slug: string) {
    setSpecialties((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function canAdvanceFromStep1() {
    return (
      scrubbedTitle.trim().length > 0 &&
      scrubbedDescription.trim().length > 0 &&
      specialties.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/maintenance/tickets/${ticket.id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scrubbedTitle: scrubbedTitle.trim(),
            scrubbedDescription: scrubbedDescription.trim(),
            specialties,
            urgency,
            budgetBand,
            deadlineAt: deadlineAt.toISOString(),
            revealAddressOnAward: revealAddress,
            revealUnitOnAward: revealUnit,
            revealOwnerPhoneOnAward: revealOwnerPhone,
            boardContactEmail: contactEmail.trim(),
            boardContactPhone: contactPhone.trim() || null,
            acceptAttestation: true,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? t("publishError"));
        return;
      }
      const data = (await res.json()) as { publicationId: string };
      onPublished(data.publicationId);
    } catch {
      setError(t("publishError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VotingModalShell
      open={open}
      onClose={onClose}
      eyebrow={t("wizardEyebrow")}
      title={
        step === 1
          ? t("wizardTitleStep1")
          : step === 2
            ? t("wizardTitleStep2")
            : t("wizardTitleStep3")
      }
      subtitle={
        step === 1 ? t("wizardLeadSubhead") : step === 2 ? t("previewSubhead") : undefined
      }
      accent="ochre"
      maxWidth={step === 2 ? 1100 : 640}
    >
      <div className="flex flex-col" style={{ minHeight: 0 }}>
        <StepBar step={step} />

        <div
          className="overflow-auto"
          style={{ padding: "0 24px 0", flex: "1 1 auto" }}
        >
          {step === 1 && (
            <Step1Content
              scrubbedTitle={scrubbedTitle}
              setScrubbedTitle={setScrubbedTitle}
              scrubbedDescription={scrubbedDescription}
              setScrubbedDescription={setScrubbedDescription}
              specialties={specialties}
              toggleSpecialty={toggleSpecialty}
              urgency={urgency}
              setUrgency={setUrgency}
              budgetBand={budgetBand}
              setBudgetBand={setBudgetBand}
              deadlinePreset={deadlinePreset}
              setDeadlinePreset={setDeadlinePreset}
              revealAddress={revealAddress}
              setRevealAddress={setRevealAddress}
              revealUnit={revealUnit}
              setRevealUnit={setRevealUnit}
              revealOwnerPhone={revealOwnerPhone}
              setRevealOwnerPhone={setRevealOwnerPhone}
              contactEmail={contactEmail}
              setContactEmail={setContactEmail}
              contactPhone={contactPhone}
              setContactPhone={setContactPhone}
            />
          )}

          {step === 2 && (
            <Step2Preview
              previewData={previewData}
              revealAddress={revealAddress}
              revealUnit={revealUnit}
              revealOwnerPhone={revealOwnerPhone}
              contactEmail={contactEmail}
              contactPhone={contactPhone}
              locale={locale}
            />
          )}

          {step === 3 && (
            <Step3Confirm
              attest={attest}
              setAttest={setAttest}
              previewData={previewData}
              locale={locale}
              error={error}
            />
          )}
        </div>

        <Footer
          step={step}
          onClose={onClose}
          onBack={() => setStep((step - 1) as Step)}
          onNext={() => setStep((step + 1) as Step)}
          onSubmit={submit}
          canAdvance={
            step === 1 ? canAdvanceFromStep1() : step === 2 ? true : attest
          }
          submitting={submitting}
        />
      </div>
    </VotingModalShell>
  );
}

// ── Step bar ──────────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const t = useTranslations("marketplace");
  const items: Array<{ idx: Step; label: string }> = [
    { idx: 1, label: t("wizardTitleStep1") },
    { idx: 2, label: t("wizardTitleStep2") },
    { idx: 3, label: t("wizardTitleStep3") },
  ];
  return (
    <div className="flex items-center gap-2" style={{ padding: "0 24px 16px" }}>
      {items.map((it) => {
        const active = it.idx === step;
        const done = it.idx < step;
        return (
          <span
            key={it.idx}
            className="font-mono"
            style={{
              padding: "6px 11px",
              borderRadius: "6px",
              fontSize: "10.5px",
              letterSpacing: "0.04em",
              border: active
                ? "1px solid var(--color-ink)"
                : done
                  ? "1px solid color-mix(in srgb, var(--color-moss) 50%, transparent)"
                  : "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
              background: active
                ? "var(--color-ink)"
                : done
                  ? "color-mix(in srgb, var(--color-moss) 18%, transparent)"
                  : "var(--color-bg-3)",
              color: active
                ? "var(--color-bg)"
                : done
                  ? "var(--color-moss)"
                  : "var(--color-ink-soft)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {done ? "✓ " : `${it.idx}. `}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Step 1: content fields ────────────────────────────────────────────────

function Step1Content(props: {
  scrubbedTitle: string;
  setScrubbedTitle: (s: string) => void;
  scrubbedDescription: string;
  setScrubbedDescription: (s: string) => void;
  specialties: string[];
  toggleSpecialty: (slug: string) => void;
  urgency: PublicationUrgency;
  setUrgency: (u: PublicationUrgency) => void;
  budgetBand: BudgetBand | null;
  setBudgetBand: (b: BudgetBand | null) => void;
  deadlinePreset: "48h" | "7d" | "14d";
  setDeadlinePreset: (p: "48h" | "7d" | "14d") => void;
  revealAddress: boolean;
  setRevealAddress: (v: boolean) => void;
  revealUnit: boolean;
  setRevealUnit: (v: boolean) => void;
  revealOwnerPhone: boolean;
  setRevealOwnerPhone: (v: boolean) => void;
  contactEmail: string;
  setContactEmail: (s: string) => void;
  contactPhone: string;
  setContactPhone: (s: string) => void;
}) {
  const t = useTranslations("marketplace");
  const locale = useLocale() as "hu" | "en";

  return (
    <div>
      <Field label={t("fieldScrubbedTitle")} htmlFor="pub-title">
        <input
          id="pub-title"
          type="text"
          value={props.scrubbedTitle}
          onChange={(e) => props.setScrubbedTitle(e.target.value)}
          placeholder={t("fieldScrubbedTitlePlaceholder")}
          style={inputStyle()}
        />
      </Field>
      <Field
        label={t("fieldScrubbedDescription")}
        htmlFor="pub-desc"
        hint={t("fieldScrubbedDescriptionHint")}
      >
        <textarea
          id="pub-desc"
          value={props.scrubbedDescription}
          onChange={(e) => props.setScrubbedDescription(e.target.value)}
          rows={5}
          style={{
            ...inputStyle(),
            padding: "12px 14px",
            resize: "vertical",
            minHeight: "120px",
          }}
        />
      </Field>

      <Field label={t("fieldSpecialty")} htmlFor="pub-spec">
        <div className="flex flex-wrap gap-1.5">
          {SPECIALTIES.map((s) => (
            <Pill
              key={s.slug}
              checked={props.specialties.includes(s.slug)}
              label={locale === "en" ? s.en : s.hu}
              onClick={() => props.toggleSpecialty(s.slug)}
            />
          ))}
        </div>
      </Field>

      <Field label={t("fieldUrgency")} htmlFor="pub-urg">
        <div className="flex flex-wrap gap-1.5">
          {PUBLICATION_URGENCIES.map((u) => (
            <Pill
              key={u.slug}
              checked={props.urgency === u.slug}
              label={locale === "en" ? u.en : u.hu}
              onClick={() => props.setUrgency(u.slug)}
            />
          ))}
        </div>
      </Field>

      <Field label={t("fieldBudget")} htmlFor="pub-budget">
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_BANDS.map((b) => (
            <Pill
              key={b.slug}
              checked={props.budgetBand === b.slug}
              label={locale === "en" ? b.en : b.hu}
              onClick={() =>
                props.setBudgetBand(props.budgetBand === b.slug ? null : b.slug)
              }
            />
          ))}
        </div>
      </Field>

      <Field label={t("fieldDeadline")} htmlFor="pub-deadline">
        <div className="flex flex-wrap gap-1.5">
          {(["48h", "7d", "14d"] as const).map((p) => (
            <Pill
              key={p}
              checked={props.deadlinePreset === p}
              label={
                p === "48h"
                  ? t("deadlinePreset48h")
                  : p === "7d"
                    ? t("deadlinePreset7d")
                    : t("deadlinePreset14d")
              }
              onClick={() => props.setDeadlinePreset(p)}
            />
          ))}
        </div>
      </Field>

      <Field label={t("fieldContactEmail")} htmlFor="pub-email">
        <input
          id="pub-email"
          type="email"
          value={props.contactEmail}
          onChange={(e) => props.setContactEmail(e.target.value)}
          style={inputStyle()}
        />
      </Field>
      <Field label={t("fieldContactPhone")} htmlFor="pub-phone">
        <input
          id="pub-phone"
          type="tel"
          value={props.contactPhone}
          onChange={(e) => props.setContactPhone(e.target.value)}
          style={inputStyle()}
        />
      </Field>

      <PrivacySection
        revealAddress={props.revealAddress}
        setRevealAddress={props.setRevealAddress}
        revealUnit={props.revealUnit}
        setRevealUnit={props.setRevealUnit}
        revealOwnerPhone={props.revealOwnerPhone}
        setRevealOwnerPhone={props.setRevealOwnerPhone}
      />

      <div style={{ height: 16 }} />
    </div>
  );
}

function PrivacySection({
  revealAddress,
  setRevealAddress,
  revealUnit,
  setRevealUnit,
  revealOwnerPhone,
  setRevealOwnerPhone,
}: {
  revealAddress: boolean;
  setRevealAddress: (v: boolean) => void;
  revealUnit: boolean;
  setRevealUnit: (v: boolean) => void;
  revealOwnerPhone: boolean;
  setRevealOwnerPhone: (v: boolean) => void;
}) {
  const t = useTranslations("marketplace");
  return (
    <div
      className="rounded-lg border"
      style={{
        marginTop: "8px",
        padding: "14px 16px",
        borderColor: "color-mix(in srgb, var(--color-ochre) 50%, transparent)",
        background: "color-mix(in srgb, var(--color-ochre) 8%, transparent)",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--color-ink)",
          margin: "0 0 4px",
        }}
      >
        {t("privacyTitle")}
      </p>
      <p
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-ink-soft)",
          letterSpacing: "0.02em",
          margin: "0 0 10px",
        }}
      >
        {t("privacyHint")}
      </p>
      <div className="flex flex-col gap-2">
        <Toggle
          label={t("revealAddress")}
          checked={revealAddress}
          onChange={setRevealAddress}
        />
        <Toggle
          label={t("revealUnit")}
          checked={revealUnit}
          onChange={setRevealUnit}
        />
        <Toggle
          label={t("revealOwnerPhone")}
          checked={revealOwnerPhone}
          onChange={setRevealOwnerPhone}
        />
      </div>
    </div>
  );
}

// ── Step 2: live preview + diff ───────────────────────────────────────────

function Step2Preview({
  previewData,
  revealAddress,
  revealUnit,
  revealOwnerPhone,
  contactEmail,
  contactPhone,
  locale,
}: {
  previewData: LeadCardData;
  revealAddress: boolean;
  revealUnit: boolean;
  revealOwnerPhone: boolean;
  contactEmail: string;
  contactPhone: string;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]"
      style={{ gap: "20px", paddingBottom: "16px" }}
    >
      <div>
        <SectionLabel>{t("previewHeading")}</SectionLabel>
        <LeadCard data={previewData} locale={locale} />
      </div>
      <div>
        <SectionLabel>{t("previewDiffHeading")}</SectionLabel>
        <DiffTable
          rows={[
            {
              field: t("previewDiffAddress"),
              shared: revealAddress,
              note: t("previewDiffOnAwardLabel"),
            },
            {
              field: t("previewDiffUnit"),
              shared: revealUnit,
              note: t("previewDiffOnAwardLabel"),
            },
            {
              field: t("previewDiffOwnerPhone"),
              shared: revealOwnerPhone,
              note: t("previewDiffOnAwardLabel"),
            },
            {
              field: t("previewDiffContactEmail"),
              shared: !!contactEmail,
              note: t("previewDiffOnAwardLabel"),
            },
            {
              field: t("previewDiffContactPhone"),
              shared: !!contactPhone,
              note: t("previewDiffOnAwardLabel"),
            },
          ]}
        />
      </div>
    </div>
  );
}

function DiffTable({
  rows,
}: {
  rows: Array<{ field: string; shared: boolean; note: string }>;
}) {
  const t = useTranslations("marketplace");
  return (
    <ul
      className="rounded-lg border flex flex-col"
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: "var(--color-bg-3)",
      }}
    >
      {rows.map((r) => (
        <li
          key={r.field}
          className="flex items-center justify-between"
          style={{
            padding: "10px 14px",
            borderTop:
              "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
            fontSize: "12.5px",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                width: "18px",
                color: r.shared ? "var(--color-good)" : "var(--color-muted)",
                fontWeight: 700,
              }}
            >
              {r.shared ? "✓" : "✗"}
            </span>
            <span
              style={{
                color: "var(--color-ink)",
                textDecoration: r.shared ? "none" : "line-through",
                textDecorationColor: "var(--color-muted)",
              }}
            >
              {r.field}
            </span>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "10.5px",
              letterSpacing: "0.04em",
              color: "var(--color-muted)",
            }}
          >
            {r.shared ? `${t("previewDiffShown")} · ${r.note}` : t("previewDiffHidden")}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Step 3: confirm + attest ──────────────────────────────────────────────

function Step3Confirm({
  attest,
  setAttest,
  previewData,
  locale,
  error,
}: {
  attest: boolean;
  setAttest: (v: boolean) => void;
  previewData: LeadCardData;
  locale: "hu" | "en";
  error: string | null;
}) {
  const t = useTranslations("marketplace");
  return (
    <div style={{ paddingBottom: "16px" }}>
      <SectionLabel>{t("previewHeading")}</SectionLabel>
      <LeadCard data={previewData} locale={locale} />

      {error && (
        <div
          role="alert"
          className="rounded-lg border"
          style={{
            margin: "16px 0 8px",
            padding: "10px 14px",
            fontSize: "13px",
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      <label
        className="flex items-start gap-2.5 cursor-pointer"
        style={{
          margin: "16px 0 0",
          padding: "12px 14px",
          borderRadius: "10px",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          background: "var(--color-bg-3)",
        }}
      >
        <input
          type="checkbox"
          checked={attest}
          onChange={(e) => setAttest(e.target.checked)}
          className="appearance-none cursor-pointer relative shrink-0"
          style={{
            width: "16px",
            height: "16px",
            marginTop: "2px",
            border:
              "1.5px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
            borderRadius: "4px",
            background: attest ? "var(--color-ink)" : "var(--color-bg)",
          }}
        />
        <span style={{ fontSize: "13px", lineHeight: 1.5 }}>
          {t("attestationCheckbox")}
        </span>
      </label>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────

function Footer({
  step,
  onClose,
  onBack,
  onNext,
  onSubmit,
  canAdvance,
  submitting,
}: {
  step: Step;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canAdvance: boolean;
  submitting: boolean;
}) {
  const t = useTranslations("marketplace");
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: "16px 24px 20px",
        borderTop: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        marginTop: "16px",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={step === 1 ? onClose : onBack}
        className="font-mono"
        style={{
          padding: "10px 16px",
          borderRadius: "8px",
          fontSize: "12px",
          letterSpacing: "0.04em",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
          background: "var(--color-bg-3)",
          color: "var(--color-ink)",
        }}
      >
        {step === 1 ? t("wizardCancel") : t("wizardBack")}
      </button>
      <button
        type="button"
        onClick={step === 3 ? onSubmit : onNext}
        disabled={!canAdvance || submitting}
        className="transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          padding: "12px 20px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          minWidth: "180px",
        }}
      >
        {submitting ? "…" : step === 3 ? t("wizardSubmit") : t("wizardNext")}
      </button>
    </div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label
        htmlFor={htmlFor}
        className="block font-mono"
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      <div>{children}</div>
      {hint && (
        <div
          className="font-mono"
          style={{
            fontSize: "10.5px",
            color: "var(--color-muted)",
            marginTop: "5px",
            letterSpacing: "0.02em",
            lineHeight: "1.45",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono block"
      style={{
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: "8px",
      }}
    >
      {children}
    </span>
  );
}

function Pill({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 12px",
        borderRadius: "6px",
        fontSize: "12.5px",
        fontWeight: checked ? 600 : 500,
        border: checked
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
        background: checked ? "var(--color-ink)" : "var(--color-bg-3)",
        color: checked ? "var(--color-bg)" : "var(--color-ink)",
        cursor: "pointer",
      }}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex items-center justify-between gap-3 cursor-pointer"
      style={{ fontSize: "13px", color: "var(--color-ink)" }}
    >
      <span>{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative",
          width: "36px",
          height: "20px",
          borderRadius: "999px",
          background: checked
            ? "var(--color-moss)"
            : "color-mix(in srgb, var(--color-ink) 20%, transparent)",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "999px",
            background: "var(--color-bg)",
            transition: "left 0.15s",
          }}
        />
      </span>
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "11px 14px",
    fontSize: "13.5px",
    color: "var(--color-ink)",
    background: "var(--color-bg-3)",
    border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    borderRadius: "8px",
    outline: "none",
  };
}
