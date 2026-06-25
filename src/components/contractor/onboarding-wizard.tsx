"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SPECIALTIES, REGIONS } from "@/lib/contractor/taxonomy";
import { AuthField, authInputStyle } from "./auth-field";

type StepIndex = 0 | 1 | 2 | 3 | 4;

interface ContractorDocDTO {
  id: string;
  kind: string;
  fileName: string;
  validUntil: string | null;
  createdAt: string;
}
interface OrgDTO {
  id: string;
  name: string;
  taxId: string;
  description: string | null;
  websiteUrl: string | null;
  specialties: unknown;
  regions: unknown;
  status: string;
  plan: string;
  navConfirmedAt: string | null;
  dpaSignedAt: string | null;
  documents: ContractorDocDTO[];
}
interface ReadinessDTO {
  ready: boolean;
  missing: {
    nav: boolean;
    dpa: boolean;
    insuranceDoc: boolean;
    licenseDoc: boolean;
    specialty: boolean;
    region: boolean;
  };
}

const STEP_KEYS: Array<{
  index: StepIndex;
  titleKey: string;
  subtitleKey: string;
}> = [
  {
    index: 0,
    titleKey: "stepProfileTitle",
    subtitleKey: "stepProfileSubtitle",
  },
  {
    index: 1,
    titleKey: "stepSpecialtiesTitle",
    subtitleKey: "stepSpecialtiesSubtitle",
  },
  {
    index: 2,
    titleKey: "stepRegionsTitle",
    subtitleKey: "stepRegionsSubtitle",
  },
  {
    index: 3,
    titleKey: "stepDocumentsTitle",
    subtitleKey: "stepDocumentsSubtitle",
  },
  {
    index: 4,
    titleKey: "stepReviewTitle",
    subtitleKey: "stepReviewSubtitle",
  },
];

export function OnboardingWizard({ locale }: { locale: "hu" | "en" }) {
  const t = useTranslations("contractorOnboarding");
  const router = useRouter();

  const [step, setStep] = useState<StepIndex>(0);
  const [org, setOrg] = useState<OrgDTO | null>(null);
  const [readiness, setReadiness] = useState<ReadinessDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);
  const [activationState, setActivationState] = useState<
    "idle" | "success" | "pending"
  >("idle");

  const reload = useCallback(async () => {
    const res = await fetch("/api/contractor/onboarding", {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { org: OrgDTO; readiness: ReadinessDTO };
    setOrg(data.org);
    setReadiness(data.readiness);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  const specialties = useMemo<string[]>(
    () => (Array.isArray(org?.specialties) ? (org!.specialties as string[]) : []),
    [org],
  );
  const regions = useMemo<string[]>(
    () => (Array.isArray(org?.regions) ? (org!.regions as string[]) : []),
    [org],
  );

  async function savePatch(payload: unknown): Promise<boolean> {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/contractor/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setSaveError(data?.error ?? t("saveFailed"));
        return false;
      }
      await reload();
      return true;
    } catch {
      setSaveError(t("saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/contractor/onboarding/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptDpa: true, locale }),
      });
      if (!res.ok) {
        setSaveError(t("saveFailed"));
        return;
      }
      const data = (await res.json()) as {
        activated: boolean;
        readiness?: ReadinessDTO;
      };
      await reload();
      if (data.activated) {
        setActivationState("success");
      } else {
        setActivationState("pending");
        if (data.readiness) setReadiness(data.readiness);
      }
    } catch {
      setSaveError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !org) {
    return (
      <div
        className="min-h-screen grid place-items-center font-mono"
        style={{
          background: "var(--color-bg)",
          color: "var(--color-muted)",
          fontSize: "13px",
          letterSpacing: "0.04em",
        }}
      >
        …
      </div>
    );
  }

  if (activationState === "success") {
    return (
      <ActivationResult
        kind="success"
        onContinue={() => router.push(`/${locale}/contractor/marketplace`)}
      />
    );
  }
  if (activationState === "pending") {
    return (
      <ActivationResult
        kind="pending"
        onContinue={() => router.push(`/${locale}/contractor/marketplace`)}
      />
    );
  }

  const currentStep = STEP_KEYS[step];

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: "720px", padding: "48px 28px 80px" }}
      >
        <Header
          orgName={org.name}
          taxId={org.taxId}
          stepIndex={step}
          totalSteps={STEP_KEYS.length}
        />

        <Stepper
          current={step}
          onJump={(i) => setStep(i)}
        />

        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "30px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: "1.1",
            margin: "32px 0 8px",
          }}
        >
          {t(currentStep.titleKey)}
        </h2>
        <p
          style={{
            color: "var(--color-ink-soft)",
            fontSize: "14.5px",
            lineHeight: "1.5",
            margin: "0 0 28px",
          }}
        >
          {t(currentStep.subtitleKey)}
        </p>

        {saveError && (
          <div
            role="alert"
            className="mb-5 rounded-lg border px-4 py-3 text-sm"
            style={{
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {saveError}
          </div>
        )}

        {step === 0 && (
          <ProfileStep
            org={org}
            saving={saving}
            onSave={async (payload) => {
              const ok = await savePatch({ action: "profile", ...payload });
              if (ok) setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <SpecialtiesStep
            selected={specialties}
            saving={saving}
            onBack={() => setStep(0)}
            onSave={async (slugs) => {
              const ok = await savePatch({ action: "specialties", specialties: slugs });
              if (ok) setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <RegionsStep
            selected={regions}
            saving={saving}
            onBack={() => setStep(1)}
            onSave={async (codes) => {
              const ok = await savePatch({ action: "regions", regions: codes });
              if (ok) setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <DocumentsStep
            docs={org.documents}
            onChange={reload}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <ReviewStep
            org={org}
            readiness={readiness}
            specialties={specialties}
            regions={regions}
            acceptDpa={acceptDpa}
            onToggleDpa={setAcceptDpa}
            saving={saving}
            onBack={() => setStep(3)}
            onFinalize={finalize}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}

// ── Header + stepper ──────────────────────────────────────────────────────

function Header({
  orgName,
  taxId,
  stepIndex,
  totalSteps,
}: {
  orgName: string;
  taxId: string;
  stepIndex: number;
  totalSteps: number;
}) {
  const t = useTranslations("contractorOnboarding");
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {t("eyebrow")}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "36px",
            fontWeight: 500,
            letterSpacing: "-0.04em",
            lineHeight: "1.05",
            margin: "8px 0 6px",
          }}
        >
          {t("title")}
        </h1>
        <p style={{ color: "var(--color-ink-soft)", fontSize: "14.5px" }}>
          {t("subtitle")}
        </p>
      </div>
      <div
        className="font-mono text-right"
        style={{
          fontSize: "11px",
          letterSpacing: "0.05em",
          color: "var(--color-muted)",
          lineHeight: "1.5",
        }}
      >
        {orgName}
        <br />
        <span style={{ color: "var(--color-ink-soft)" }}>{taxId}</span>
        <br />
        {t("step")} {stepIndex + 1} {t("of")} {totalSteps}
      </div>
    </div>
  );
}

function Stepper({
  current,
  onJump,
}: {
  current: StepIndex;
  onJump: (i: StepIndex) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STEP_KEYS.map((s) => {
        const active = s.index === current;
        const completed = s.index < current;
        return (
          <button
            key={s.index}
            type="button"
            onClick={() => onJump(s.index)}
            className="font-mono"
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              letterSpacing: "0.04em",
              border: active
                ? "1px solid var(--color-ink)"
                : completed
                  ? "1px solid color-mix(in srgb, var(--color-moss) 50%, transparent)"
                  : "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
              background: active
                ? "var(--color-ink)"
                : completed
                  ? "color-mix(in srgb, var(--color-moss) 15%, transparent)"
                  : "var(--color-bg-3)",
              color: active
                ? "var(--color-bg)"
                : completed
                  ? "var(--color-moss)"
                  : "var(--color-ink-soft)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {completed ? "✓ " : `${s.index + 1}. `}
            <StepDot index={s.index} />
          </button>
        );
      })}
    </div>
  );
}

function StepDot({ index }: { index: StepIndex }) {
  const t = useTranslations("contractorOnboarding");
  const labels = [
    t("stepProfileTitle"),
    t("stepSpecialtiesTitle"),
    t("stepRegionsTitle"),
    t("stepDocumentsTitle"),
    t("stepReviewTitle"),
  ];
  return <>{labels[index]}</>;
}

// ── Step: profile ─────────────────────────────────────────────────────────

function ProfileStep({
  org,
  saving,
  onSave,
}: {
  org: OrgDTO;
  saving: boolean;
  onSave: (payload: {
    name: string;
    description: string | null;
    websiteUrl: string | null;
  }) => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [website, setWebsite] = useState(org.websiteUrl ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: name.trim(),
          description: description.trim() || null,
          websiteUrl: website.trim() || null,
        });
      }}
    >
      <AuthField label={t("fieldOrgName")} htmlFor="org-name">
        <input
          id="org-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("fieldOrgNamePlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>

      <AuthField
        label={t("fieldDescription")}
        htmlFor="org-desc"
        hint={t("fieldDescriptionHint")}
      >
        <textarea
          id="org-desc"
          value={description}
          maxLength={600}
          rows={5}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("fieldDescriptionPlaceholder")}
          style={{
            ...authInputStyle(false),
            padding: "12px 14px",
            resize: "vertical",
            minHeight: "120px",
          }}
        />
      </AuthField>

      <AuthField label={t("fieldWebsite")} htmlFor="org-web">
        <input
          id="org-web"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t("fieldWebsitePlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>

      <WizardActions next={t("next")} loading={saving} />
    </form>
  );
}

// ── Step: specialties ─────────────────────────────────────────────────────

function SpecialtiesStep({
  selected,
  saving,
  onBack,
  onSave,
}: {
  selected: string[];
  saving: boolean;
  onBack: () => void;
  onSave: (slugs: string[]) => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));

  function toggle(slug: string) {
    const next = new Set(chosen);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setChosen(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Array.from(chosen));
      }}
    >
      <div
        className="grid grid-cols-2 gap-2"
        style={{ marginBottom: "20px" }}
      >
        {SPECIALTIES.map((s) => (
          <PillCheckbox
            key={s.slug}
            checked={chosen.has(s.slug)}
            label={s.hu}
            onChange={() => toggle(s.slug)}
          />
        ))}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          marginBottom: "16px",
          letterSpacing: "0.04em",
        }}
      >
        {t("specialtiesCount", { count: chosen.size })}
      </div>
      <WizardActions
        onBack={onBack}
        back={t("back")}
        next={t("next")}
        loading={saving}
        disabled={chosen.size === 0}
      />
    </form>
  );
}

// ── Step: regions ─────────────────────────────────────────────────────────

function RegionsStep({
  selected,
  saving,
  onBack,
  onSave,
}: {
  selected: string[];
  saving: boolean;
  onBack: () => void;
  onSave: (codes: string[]) => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));

  const budapest = REGIONS.filter((r) => r.code.startsWith("BP-"));
  const counties = REGIONS.filter((r) => !r.code.startsWith("BP-"));

  function toggle(code: string) {
    const next = new Set(chosen);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setChosen(next);
  }

  function selectAllBudapest() {
    const next = new Set(chosen);
    for (const r of budapest) next.add(r.code);
    setChosen(next);
  }

  function clearAll() {
    setChosen(new Set());
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Array.from(chosen));
      }}
    >
      <SectionHeader
        label={t("regionsBudapest")}
        right={
          <button
            type="button"
            onClick={selectAllBudapest}
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-ink)",
              textDecoration: "underline",
              letterSpacing: "0.04em",
            }}
          >
            {t("selectAllBudapest")}
          </button>
        }
      />
      {/* eslint-disable-next-line responsive/mobile-first -- short district codes (I, II, III...) fit 3 per row at 360px */}
      <div
        className="grid grid-cols-3 gap-1.5"
        style={{ marginBottom: "20px" }}
      >
        {budapest.map((r) => (
          <PillCheckbox
            key={r.code}
            compact
            checked={chosen.has(r.code)}
            label={r.code.replace("BP-", "")}
            title={r.hu}
            onChange={() => toggle(r.code)}
          />
        ))}
      </div>

      <SectionHeader label={t("regionsCountry")} />
      <div
        className="grid grid-cols-2 gap-1.5"
        style={{ marginBottom: "16px" }}
      >
        {counties.map((r) => (
          <PillCheckbox
            key={r.code}
            checked={chosen.has(r.code)}
            label={r.hu}
            onChange={() => toggle(r.code)}
          />
        ))}
      </div>

      <div
        className="flex items-center justify-between"
        style={{ marginBottom: "12px" }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {t("regionsCount", { count: chosen.size })}
        </span>
        <button
          type="button"
          onClick={clearAll}
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            textDecoration: "underline",
            letterSpacing: "0.04em",
          }}
        >
          {t("clearAll")}
        </button>
      </div>

      <WizardActions
        onBack={onBack}
        back={t("back")}
        next={t("next")}
        loading={saving}
        disabled={chosen.size === 0}
      />
    </form>
  );
}

// ── Step: documents ───────────────────────────────────────────────────────

function DocumentsStep({
  docs,
  onChange,
  onBack,
  onNext,
}: {
  docs: ContractorDocDTO[];
  onChange: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("contractorOnboarding");
  const hasInsurance = docs.some((d) => d.kind === "insurance");
  const hasLicense = docs.some((d) => d.kind === "license");

  return (
    <div>
      <div className="flex flex-col gap-3">
        <DocumentUploader
          kind="insurance"
          label={t("uploadInsurance")}
          required
          onUploaded={onChange}
        />
        <DocumentUploader
          kind="license"
          label={t("uploadLicense")}
          required
          onUploaded={onChange}
        />
        <DocumentUploader
          kind="reference"
          label={t("uploadReference")}
          onUploaded={onChange}
        />
      </div>

      <div
        className="rounded-xl border"
        style={{
          marginTop: "24px",
          padding: docs.length ? "8px 12px" : "16px",
          borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
          background: "var(--color-bg-3)",
        }}
      >
        {docs.length === 0 ? (
          <span
            className="font-mono"
            style={{
              fontSize: "12px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {t("noDocsYet")}
          </span>
        ) : (
          <ul className="flex flex-col gap-1">
            {docs.map((d) => (
              <DocumentRow key={d.id} doc={d} onDeleted={onChange} />
            ))}
          </ul>
        )}
      </div>

      <WizardActions
        onBack={onBack}
        back={t("back")}
        next={t("next")}
        loading={false}
        onNextClick={onNext}
        disabled={!hasInsurance || !hasLicense}
      />
    </div>
  );
}

function DocumentUploader({
  kind,
  label,
  required,
  onUploaded,
}: {
  kind: "insurance" | "license" | "reference" | "other";
  label: string;
  required?: boolean;
  onUploaded: () => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 20 * 1024 * 1024) {
      setError(t("fileTooLarge"));
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    try {
      const res = await fetch("/api/contractor/onboarding/documents", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setError(t("uploadFailed"));
        return;
      }
      await onUploaded();
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const inputId = `up-${kind}`;
  return (
    <label
      htmlFor={inputId}
      className="flex items-center justify-between gap-4"
      style={{
        padding: "14px 16px",
        border:
          "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
        borderRadius: "10px",
        background: "var(--color-bg-3)",
        cursor: "pointer",
      }}
    >
      <div className="flex flex-col">
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--color-ink)",
          }}
        >
          {label}
          {required ? "" : ""}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: error ? "var(--color-danger)" : "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "3px",
          }}
        >
          {uploading
            ? t("uploadingLabel")
            : error
              ? error
              : t("uploadDrop")}
        </span>
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-ink)",
          padding: "5px 10px",
          borderRadius: "6px",
          border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
          background: "var(--color-bg)",
          letterSpacing: "0.04em",
        }}
      >
        PDF / JPG / PNG
      </span>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function DocumentRow({
  doc,
  onDeleted,
}: {
  doc: ContractorDocDTO;
  onDeleted: () => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contractor/onboarding/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (res.ok) await onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  const kindLabel =
    doc.kind === "insurance"
      ? t("uploadKindInsurance")
      : doc.kind === "license"
        ? t("uploadKindLicense")
        : doc.kind === "reference"
          ? t("uploadKindReference")
          : t("uploadKindOther");

  return (
    <li
      className="flex items-center justify-between"
      style={{
        padding: "8px 8px",
        borderRadius: "6px",
        background:
          "color-mix(in srgb, var(--color-moss) 8%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            padding: "3px 8px",
            borderRadius: "4px",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            letterSpacing: "0.05em",
            flexShrink: 0,
          }}
        >
          {kindLabel}
        </span>
        <span
          className="truncate"
          style={{ fontSize: "13px", color: "var(--color-ink)" }}
          title={doc.fileName}
        >
          {doc.fileName}
        </span>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-danger)",
          letterSpacing: "0.04em",
          textDecoration: "underline",
        }}
      >
        {t("deleteDoc")}
      </button>
    </li>
  );
}

// ── Step: review ──────────────────────────────────────────────────────────

function ReviewStep({
  org,
  readiness,
  specialties,
  regions,
  acceptDpa,
  onToggleDpa,
  saving,
  onBack,
  onFinalize,
  locale,
}: {
  org: OrgDTO;
  readiness: ReadinessDTO | null;
  specialties: string[];
  regions: string[];
  acceptDpa: boolean;
  onToggleDpa: (v: boolean) => void;
  saving: boolean;
  onBack: () => void;
  onFinalize: () => Promise<void>;
  locale: "hu" | "en";
}) {
  const t = useTranslations("contractorOnboarding");

  const labelForSpec = (slug: string) => {
    const m = SPECIALTIES.find((s) => s.slug === slug);
    return m ? (locale === "en" ? m.en : m.hu) : slug;
  };
  const labelForRegion = (code: string) => {
    const m = REGIONS.find((r) => r.code === code);
    return m ? (locale === "en" ? m.en : m.hu) : code;
  };

  return (
    <div>
      <ReviewBlock label={t("reviewProfile")}>
        <div style={{ fontSize: "14.5px", color: "var(--color-ink)" }}>
          <strong>{org.name}</strong>
          {org.websiteUrl ? (
            <>
              {" · "}
              <a
                href={org.websiteUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--color-ink)",
                  textDecoration: "underline",
                }}
              >
                {org.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            </>
          ) : null}
          {org.description ? (
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--color-ink-soft)",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              {org.description}
            </p>
          ) : null}
        </div>
      </ReviewBlock>

      <ReviewBlock label={t("reviewSpecialties")}>
        {specialties.length === 0 ? (
          <Muted>{t("reviewNoSpecialty")}</Muted>
        ) : (
          <Chips items={specialties.map(labelForSpec)} />
        )}
      </ReviewBlock>

      <ReviewBlock label={t("reviewRegions")}>
        {regions.length === 0 ? (
          <Muted>{t("reviewNoRegion")}</Muted>
        ) : (
          <Chips items={regions.map(labelForRegion)} />
        )}
      </ReviewBlock>

      <ReviewBlock label={t("reviewDocuments")}>
        {org.documents.length === 0 ? (
          <Muted>{t("reviewNoDocs")}</Muted>
        ) : (
          <Chips
            items={org.documents.map(
              (d) =>
                `${
                  d.kind === "insurance"
                    ? t("uploadKindInsurance")
                    : d.kind === "license"
                      ? t("uploadKindLicense")
                      : d.kind === "reference"
                        ? t("uploadKindReference")
                        : t("uploadKindOther")
                }: ${d.fileName}`,
            )}
          />
        )}
      </ReviewBlock>

      {readiness && !readiness.ready && (
        <MissingHints missing={readiness.missing} />
      )}

      <label
        className="flex items-start gap-2.5 cursor-pointer"
        style={{ margin: "16px 0 8px", color: "var(--color-ink-soft)" }}
      >
        <input
          type="checkbox"
          checked={acceptDpa}
          onChange={(e) => onToggleDpa(e.target.checked)}
          required
          className="appearance-none cursor-pointer relative shrink-0"
          style={{
            width: "16px",
            height: "16px",
            marginTop: "2px",
            border:
              "1.5px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
            borderRadius: "4px",
            background: acceptDpa ? "var(--color-ink)" : "var(--color-bg-3)",
          }}
        />
        <span style={{ fontSize: "13px", lineHeight: 1.45 }}>
          {t("acceptDpa")}{" "}
          <a
            href="#"
            style={{
              color: "var(--color-ink)",
              fontWeight: 500,
              textDecoration: "underline",
            }}
          >
            {t("dpaLink")}
          </a>{" "}
          {t("acceptDpaSuffix")}
        </span>
      </label>
      <p
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          marginBottom: "20px",
        }}
      >
        {t("acceptDpaHint")}
      </p>

      <WizardActions
        onBack={onBack}
        back={t("back")}
        next={t("finalize")}
        loading={saving}
        disabled={!acceptDpa}
        onNextClick={onFinalize}
      />
    </div>
  );
}

function MissingHints({
  missing,
}: {
  missing: ReadinessDTO["missing"];
}) {
  const t = useTranslations("contractorOnboarding");
  const items: string[] = [];
  if (missing.specialty) items.push(t("missingSpecialty"));
  if (missing.region) items.push(t("missingRegion"));
  if (missing.insuranceDoc) items.push(t("missingInsurance"));
  if (missing.licenseDoc) items.push(t("missingLicense"));
  if (items.length === 0) return null;
  return (
    <ul
      className="rounded-lg border"
      style={{
        margin: "12px 0 0",
        padding: "10px 14px",
        listStyle: "disc inside",
        borderColor:
          "color-mix(in srgb, var(--color-ochre) 50%, transparent)",
        background: "color-mix(in srgb, var(--color-ochre) 14%, transparent)",
        color: "var(--color-ink)",
        fontSize: "13px",
        lineHeight: "1.6",
      }}
    >
      {items.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────

function PillCheckbox({
  checked,
  label,
  onChange,
  compact,
  title,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  compact?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={title ?? label}
      style={{
        padding: compact ? "8px 10px" : "10px 14px",
        borderRadius: "8px",
        fontSize: compact ? "12px" : "13px",
        fontWeight: checked ? 600 : 500,
        textAlign: "left",
        border: checked
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
        background: checked ? "var(--color-ink)" : "var(--color-bg-3)",
        color: checked ? "var(--color-bg)" : "var(--color-ink)",
        transition: "background 0.1s, border-color 0.1s",
        cursor: "pointer",
      }}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}

function SectionHeader({
  label,
  right,
}: {
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ margin: "0 0 10px" }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {right}
    </div>
  );
}

function ReviewBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border"
      style={{
        marginBottom: "10px",
        padding: "12px 14px",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: "var(--color-bg-3)",
      }}
    >
      <span
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="font-mono"
          style={{
            fontSize: "11px",
            padding: "4px 8px",
            borderRadius: "5px",
            background: "var(--color-bg)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            letterSpacing: "0.02em",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "12px",
        color: "var(--color-muted)",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

function WizardActions({
  back,
  next,
  onBack,
  onNextClick,
  loading,
  disabled,
}: {
  back?: string;
  next: string;
  onBack?: () => void;
  onNextClick?: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginTop: "28px" }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="font-mono"
          style={{
            padding: "11px 18px",
            borderRadius: "10px",
            fontSize: "12.5px",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            background: "var(--color-bg-3)",
            color: "var(--color-ink)",
            letterSpacing: "0.04em",
          }}
        >
          ← {back}
        </button>
      ) : (
        <span />
      )}
      <button
        type={onNextClick ? "button" : "submit"}
        onClick={onNextClick}
        disabled={loading || disabled}
        className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          padding: "13px 22px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
          minWidth: "160px",
        }}
      >
        {loading ? "…" : (
          <>
            {next} <span>→</span>
          </>
        )}
      </button>
    </div>
  );
}

// ── Activation result screen ──────────────────────────────────────────────

function ActivationResult({
  kind,
  onContinue,
}: {
  kind: "success" | "pending";
  onContinue: () => void;
}) {
  const t = useTranslations("contractorOnboarding");
  return (
    <div
      className="min-h-screen grid place-items-center"
      style={{ background: "var(--color-bg)", padding: "32px" }}
    >
      <div style={{ maxWidth: "520px", textAlign: "center" }}>
        <span
          className="grid place-items-center mx-auto"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background:
              kind === "success" ? "var(--color-moss)" : "var(--color-ochre)",
            color:
              kind === "success" ? "var(--color-bg)" : "var(--color-ink)",
            fontSize: "26px",
            marginBottom: "20px",
          }}
        >
          {kind === "success" ? "✓" : "…"}
        </span>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: "1.1",
            margin: "0 0 10px",
          }}
        >
          {kind === "success" ? t("successTitle") : t("pendingTitle")}
        </h1>
        <p
          style={{
            color: "var(--color-ink-soft)",
            fontSize: "15px",
            lineHeight: "1.55",
            margin: "0 0 24px",
          }}
        >
          {kind === "success" ? t("successBody") : t("pendingBody")}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            padding: "13px 22px",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {t("successGoMarket")}
        </button>
      </div>
    </div>
  );
}
