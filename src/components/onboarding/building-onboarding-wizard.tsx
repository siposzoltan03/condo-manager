"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ImportUnitsButton } from "@/components/units/import-units-button";

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
const TOTAL_STEPS = 6;

const MAJORITY_OPTIONS = [
  "SIMPLE_MAJORITY",
  "TWO_THIRDS",
  "FOUR_FIFTHS",
  "UNANIMOUS",
] as const;
const COST_BASIS_OPTIONS = ["OWNERSHIP_SHARE", "EQUAL", "AREA"] as const;

interface OnboardingState {
  building: {
    id: string;
    name: string;
    address: string;
    city: string;
    zipCode: string;
    reserveTargetHUF: number;
    defaultMajority: string;
    costAllocationBasis: string;
    onboardingCompletedAt: string | null;
  };
  progress: {
    unitCount: number;
    ownershipShare: number;
    sharesComplete: boolean;
    szmszDocCount: number;
    memberCount: number;
  };
  szmszCategoryId: string | null;
}

export function BuildingOnboardingWizard({ locale }: { locale: string }) {
  const t = useTranslations("buildingOnboarding");
  const router = useRouter();

  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/onboarding", { cache: "no-store" });
    if (!res.ok) return;
    setState((await res.json()) as OnboardingState);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  async function savePatch(payload: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? t("saveFailed"));
        return false;
      }
      await reload();
      return true;
    } catch {
      setError(t("saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/finalize", { method: "POST" });
      if (!res.ok) {
        setError(t("saveFailed"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !state) {
    return (
      <div
        className="grid place-items-center font-mono"
        style={{
          minHeight: "60vh",
          color: "var(--color-muted)",
          fontSize: "13px",
          letterSpacing: "0.04em",
        }}
      >
        …
      </div>
    );
  }

  if (done) {
    return (
      <FinishScreen
        onContinue={() => router.push(`/${locale}/dashboard`)}
        title={t("doneTitle")}
        body={t("doneBody")}
        cta={t("doneCta")}
      />
    );
  }

  const stepTitles = [
    t("steps.basics"),
    t("steps.governance"),
    t("steps.units"),
    t("steps.szmsz"),
    t("steps.invites"),
    t("steps.review"),
  ];

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 28px 80px" }}>
      <div className="flex items-start justify-between gap-4" style={{ marginBottom: "24px" }}>
        <div>
          <span
            className="font-mono"
            style={{ fontSize: "12px", color: "var(--color-ochre)", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            {t("eyebrow")}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              margin: "8px 0 6px",
            }}
          >
            {t("title")}
          </h1>
          <p style={{ color: "var(--color-ink-soft)", fontSize: "14.5px" }}>{t("subtitle")}</p>
        </div>
        <div
          className="font-mono text-right"
          style={{ fontSize: "11px", letterSpacing: "0.05em", color: "var(--color-muted)", whiteSpace: "nowrap" }}
        >
          {t("stepCounter", { current: step + 1, total: TOTAL_STEPS })}
        </div>
      </div>

      <Stepper current={step} titles={stepTitles} onJump={(i) => setStep(i as StepIndex)} />

      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.03em",
          margin: "28px 0 6px",
        }}
      >
        {stepTitles[step]}
      </h2>
      <p style={{ color: "var(--color-ink-soft)", fontSize: "14px", margin: "0 0 24px" }}>
        {t(`subtitles.${["basics", "governance", "units", "szmsz", "invites", "review"][step]}`)}
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-lg border"
          style={{
            marginBottom: "20px",
            padding: "10px 14px",
            fontSize: "13px",
            background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      {step === 0 && (
        <BasicsStep
          state={state}
          saving={saving}
          onSave={async (p) => {
            if (await savePatch({ action: "basics", ...p })) setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <GovernanceStep
          state={state}
          saving={saving}
          onBack={() => setStep(0)}
          onSave={async (p) => {
            if (await savePatch({ action: "governance", ...p })) setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <UnitsStep
          state={state}
          locale={locale}
          onReload={reload}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <SzmszStep
          state={state}
          locale={locale}
          onReload={reload}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <InvitesStep
          state={state}
          locale={locale}
          onReload={reload}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}
      {step === 5 && (
        <ReviewStep
          state={state}
          saving={saving}
          onBack={() => setStep(4)}
          onFinalize={finalize}
        />
      )}
    </div>
  );
}

// ── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
  current,
  titles,
  onJump,
}: {
  current: number;
  titles: string[];
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {titles.map((title, i) => {
        const active = i === current;
        const completed = i < current;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            className="font-mono"
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              letterSpacing: "0.03em",
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
              color: active ? "var(--color-bg)" : completed ? "var(--color-moss)" : "var(--color-ink-soft)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {completed ? "✓ " : `${i + 1}. `}
            {title}
          </button>
        );
      })}
    </div>
  );
}

// ── Step: basics ──────────────────────────────────────────────────────────

function BasicsStep({
  state,
  saving,
  onSave,
}: {
  state: OnboardingState;
  saving: boolean;
  onSave: (p: { name: string; address: string; city: string; zipCode: string }) => Promise<void>;
}) {
  const t = useTranslations("buildingOnboarding");
  const [name, setName] = useState(state.building.name);
  const [address, setAddress] = useState(state.building.address);
  const [city, setCity] = useState(state.building.city);
  const [zipCode, setZipCode] = useState(state.building.zipCode);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: name.trim(), address: address.trim(), city: city.trim(), zipCode: zipCode.trim() });
      }}
    >
      <Field label={t("fields.name")} htmlFor="ob-name">
        <input id="ob-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      </Field>
      <Field label={t("fields.address")} htmlFor="ob-address">
        <input id="ob-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t("fields.zipCode")} htmlFor="ob-zip">
          <input id="ob-zip" type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} style={inputStyle} />
        </Field>
        <Field label={t("fields.city")} htmlFor="ob-city">
          <input id="ob-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <WizardActions next={t("next")} loading={saving} disabled={name.trim().length === 0} />
    </form>
  );
}

// ── Step: governance ────────────────────────────────────────────────────────

function GovernanceStep({
  state,
  saving,
  onBack,
  onSave,
}: {
  state: OnboardingState;
  saving: boolean;
  onBack: () => void;
  onSave: (p: {
    reserveTargetHUF: number;
    defaultMajority: string;
    costAllocationBasis: string;
  }) => Promise<void>;
}) {
  const t = useTranslations("buildingOnboarding");
  const [reserve, setReserve] = useState(String(state.building.reserveTargetHUF || ""));
  const [majority, setMajority] = useState(state.building.defaultMajority);
  const [basis, setBasis] = useState(state.building.costAllocationBasis);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          reserveTargetHUF: Number(reserve) || 0,
          defaultMajority: majority,
          costAllocationBasis: basis,
        });
      }}
    >
      <Field label={t("fields.reserveTarget")} htmlFor="ob-reserve" hint={t("fields.reserveTargetHint")}>
        <input
          id="ob-reserve"
          type="number"
          min={0}
          step={100000}
          value={reserve}
          onChange={(e) => setReserve(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />
      </Field>
      <Field label={t("fields.defaultMajority")} htmlFor="ob-majority">
        <select id="ob-majority" value={majority} onChange={(e) => setMajority(e.target.value)} style={inputStyle}>
          {MAJORITY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(`majority.${o}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("fields.costBasis")} htmlFor="ob-basis">
        <select id="ob-basis" value={basis} onChange={(e) => setBasis(e.target.value)} style={inputStyle}>
          {COST_BASIS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(`costBasis.${o}`)}
            </option>
          ))}
        </select>
      </Field>
      <WizardActions onBack={onBack} back={t("back")} next={t("next")} loading={saving} />
    </form>
  );
}

// ── Step: units ───────────────────────────────────────────────────────────

function UnitsStep({
  state,
  locale,
  onReload,
  onBack,
  onNext,
}: {
  state: OnboardingState;
  locale: string;
  onReload: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("buildingOnboarding");
  const { unitCount, ownershipShare, sharesComplete } = state.progress;
  const pct = (ownershipShare * 100).toLocaleString(locale === "en" ? "en-US" : "hu-HU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div>
      <StatusCard
        done={sharesComplete}
        title={t("units.statusTitle", { count: unitCount })}
        detail={t("units.statusShare", { pct })}
      />
      <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "16px" }}>
        <ImportUnitsButton />
        <button type="button" onClick={onReload} style={ghostButtonStyle}>
          {t("refresh")}
        </button>
        <Link href={`/${locale}/units`} style={ghostButtonStyle}>
          {t("units.openUnits")} →
        </Link>
      </div>
      <WizardActions onBack={onBack} back={t("back")} next={t("next")} loading={false} onNextClick={onNext} />
    </div>
  );
}

// ── Step: SZMSZ ─────────────────────────────────────────────────────────────

function SzmszStep({
  state,
  locale,
  onReload,
  onBack,
  onNext,
}: {
  state: OnboardingState;
  locale: string;
  onReload: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("buildingOnboarding");
  const { szmszDocCount } = state.progress;
  const docsHref = state.szmszCategoryId
    ? `/${locale}/documents?categoryId=${state.szmszCategoryId}`
    : `/${locale}/documents`;

  return (
    <div>
      <StatusCard
        done={szmszDocCount > 0}
        title={t("szmsz.statusTitle", { count: szmszDocCount })}
        detail={t("szmsz.statusDetail")}
      />
      <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "16px" }}>
        <Link href={docsHref} style={primaryLinkStyle}>
          {t("szmsz.openDocuments")} →
        </Link>
        <button type="button" onClick={onReload} style={ghostButtonStyle}>
          {t("refresh")}
        </button>
      </div>
      <WizardActions onBack={onBack} back={t("back")} next={t("nextSkippable")} loading={false} onNextClick={onNext} />
    </div>
  );
}

// ── Step: invites ─────────────────────────────────────────────────────────

function InvitesStep({
  state,
  locale,
  onReload,
  onBack,
  onNext,
}: {
  state: OnboardingState;
  locale: string;
  onReload: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("buildingOnboarding");
  const { memberCount } = state.progress;

  return (
    <div>
      <StatusCard
        done={memberCount > 1}
        title={t("invites.statusTitle", { count: memberCount })}
        detail={t("invites.statusDetail")}
      />
      <div className="flex flex-wrap items-center gap-3" style={{ marginTop: "16px" }}>
        <Link href={`/${locale}/residents`} style={primaryLinkStyle}>
          {t("invites.openResidents")} →
        </Link>
        <button type="button" onClick={onReload} style={ghostButtonStyle}>
          {t("refresh")}
        </button>
      </div>
      <WizardActions onBack={onBack} back={t("back")} next={t("nextSkippable")} loading={false} onNextClick={onNext} />
    </div>
  );
}

// ── Step: review ────────────────────────────────────────────────────────────

function ReviewStep({
  state,
  saving,
  onBack,
  onFinalize,
}: {
  state: OnboardingState;
  saving: boolean;
  onBack: () => void;
  onFinalize: () => Promise<void>;
}) {
  const t = useTranslations("buildingOnboarding");
  const { building, progress } = state;
  const pct = (progress.ownershipShare * 100).toLocaleString("hu-HU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div>
      <ReviewRow label={t("steps.basics")} value={`${building.name}${building.city ? ` · ${building.zipCode} ${building.city}` : ""}`} />
      <ReviewRow
        label={t("steps.governance")}
        value={`${t(`majority.${building.defaultMajority}`)} · ${t(`costBasis.${building.costAllocationBasis}`)} · ${building.reserveTargetHUF.toLocaleString("hu-HU")} Ft`}
      />
      <ReviewRow label={t("steps.units")} value={t("review.units", { count: progress.unitCount, pct })} done={progress.sharesComplete} />
      <ReviewRow label={t("steps.szmsz")} value={t("review.szmsz", { count: progress.szmszDocCount })} done={progress.szmszDocCount > 0} />
      <ReviewRow label={t("steps.invites")} value={t("review.invites", { count: progress.memberCount })} done={progress.memberCount > 1} />

      <p
        className="font-mono"
        style={{ fontSize: "11px", color: "var(--color-muted)", letterSpacing: "0.03em", margin: "16px 0 0" }}
      >
        {t("review.note")}
      </p>

      <WizardActions onBack={onBack} back={t("back")} next={t("finish")} loading={saving} onNextClick={onFinalize} />
    </div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: "10px",
  fontSize: "14px",
  border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)",
  background: "var(--color-bg)",
  color: "var(--color-ink)",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  background: "var(--color-card)",
  color: "var(--color-ink)",
  border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const primaryLinkStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  background: "var(--color-ink)",
  color: "var(--color-bg)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

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
    <div style={{ marginBottom: "16px" }}>
      <label
        htmlFor={htmlFor}
        className="block"
        style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-ink)", marginBottom: "6px" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-muted)", marginTop: "5px", letterSpacing: "0.02em" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function StatusCard({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl"
      style={{
        padding: "16px 18px",
        background: done ? "color-mix(in srgb, var(--color-moss) 8%, transparent)" : "var(--color-bg-2)",
        border: done
          ? "1px solid color-mix(in srgb, var(--color-moss) 25%, transparent)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center shrink-0"
        style={{
          width: "26px",
          height: "26px",
          borderRadius: "999px",
          background: done ? "var(--color-moss)" : "transparent",
          border: done ? "none" : "2px solid color-mix(in srgb, var(--color-ink) 25%, transparent)",
          color: "#f5f2e6",
          fontSize: "14px",
        }}
      >
        {done ? "✓" : ""}
      </span>
      <div>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-ink)" }}>{title}</div>
        <div style={{ fontSize: "13px", color: "var(--color-ink-soft)", marginTop: "2px" }}>{detail}</div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-lg"
      style={{
        marginBottom: "8px",
        padding: "12px 14px",
        background: "var(--color-bg-3)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <span
        className="font-mono"
        style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.08em", textTransform: "uppercase", paddingTop: "2px", minWidth: "92px" }}
      >
        {label}
      </span>
      <span style={{ flex: 1, fontSize: "14px", color: "var(--color-ink)", textAlign: "right" }}>
        {done !== undefined && (
          <span style={{ color: done ? "var(--color-moss)" : "var(--color-ochre)", marginRight: "6px" }}>{done ? "✓" : "○"}</span>
        )}
        {value}
      </span>
    </div>
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
    <div className="flex items-center justify-between" style={{ marginTop: "28px" }}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="font-mono"
          style={{
            padding: "11px 18px",
            borderRadius: "10px",
            fontSize: "12.5px",
            border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            background: "var(--color-bg-3)",
            color: "var(--color-ink)",
            letterSpacing: "0.03em",
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
          minWidth: "150px",
        }}
      >
        {loading ? "…" : <>{next} →</>}
      </button>
    </div>
  );
}

function FinishScreen({
  onContinue,
  title,
  body,
  cta,
}: {
  onContinue: () => void;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div className="grid place-items-center" style={{ minHeight: "60vh", padding: "32px" }}>
      <div style={{ maxWidth: "480px", textAlign: "center" }}>
        <span
          className="grid place-items-center mx-auto"
          style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--color-moss)", color: "#f5f2e6", fontSize: "26px", marginBottom: "20px" }}
        >
          ✓
        </span>
        <h1
          style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontSize: "30px", fontWeight: 500, letterSpacing: "-0.03em", margin: "0 0 10px" }}
        >
          {title}
        </h1>
        <p style={{ color: "var(--color-ink-soft)", fontSize: "15px", lineHeight: 1.55, margin: "0 0 24px" }}>{body}</p>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)", padding: "13px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: 600 }}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
