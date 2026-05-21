"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SPECIALTIES, REGIONS } from "@/lib/contractor/taxonomy";
import { AuthField, authInputStyle } from "./auth-field";
import { PageHead } from "./page-head";
import { SettingsTabs } from "./settings-tabs";

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
  documents: ContractorDocDTO[];
}

/**
 * Post-activation settings. Flat layout: every section saves on its own
 * "Mentés" button, with a small "Mentve · 12:34" hint after success.
 * Reuses the same `/api/contractor/onboarding` endpoint family.
 */
export function ContractorSettings({
  locale,
  tab = "profile",
}: {
  locale: "hu" | "en";
  tab?: "profile" | "documents";
}) {
  const t = useTranslations("contractorOnboarding");

  const [org, setOrg] = useState<OrgDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch("/api/contractor/onboarding", {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { org: OrgDTO };
    setOrg(data.org);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

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

  return (
    <div style={{ color: "var(--color-ink)" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "720px", padding: "48px 28px 80px" }}
      >
        <PageHead
          eyebrow={`/ ${t("settingsTitle")}`}
          title={t("settingsTitle")}
          subtitle={t("settingsSubtitle")}
        />

        <SettingsTabs locale={locale} active={tab} />

        {tab === "profile" ? (
          <>
            <ProfileSection org={org} onSaved={reload} />
            <SpecialtiesSection
              initial={
                Array.isArray(org.specialties) ? (org.specialties as string[]) : []
              }
              onSaved={reload}
              locale={locale}
            />
            <RegionsSection
              initial={
                Array.isArray(org.regions) ? (org.regions as string[]) : []
              }
              onSaved={reload}
              locale={locale}
            />
            <DataExportSection />
          </>
        ) : (
          <DocumentsSection docs={org.documents} onChange={reload} />
        )}
      </div>
    </div>
  );
}

function DataExportSection() {
  const t = useTranslations("marketplace");
  const tOnboarding = useTranslations("contractorOnboarding");
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const res = await fetch("/api/contractor/settings/export");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const filenameMatch = cd.match(/filename="([^"]+)"/);
      a.download = filenameMatch?.[1] ?? "kozos-contractor-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-xl border"
      style={{
        marginTop: "16px",
        padding: "20px 22px",
        background: "var(--color-bg-3)",
        borderColor:
          "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "20px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          margin: "0 0 4px",
        }}
      >
        {t("exportTitle")}
      </h2>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "13.5px",
          margin: "0 0 14px",
          lineHeight: 1.55,
        }}
      >
        {t("exportDescription")}
      </p>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="disabled:opacity-60"
        style={{
          padding: "10px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
        }}
      >
        {busy ? tOnboarding("uploadingLabel") : t("exportButton")}
      </button>
    </section>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────

function ProfileSection({
  org,
  onSaved,
}: {
  org: OrgDTO;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [website, setWebsite] = useState(org.websiteUrl ?? "");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contractor/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile",
          name: name.trim(),
          description: description.trim() || null,
          websiteUrl: website.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? t("saveFailed"));
        return;
      }
      setSavedAt(new Date());
      await onSaved();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t("stepProfileTitle")}
      subtitle={t("stepProfileSubtitle")}
      savedAt={savedAt}
      saving={saving}
      error={error}
      onSave={save}
    >
      <AuthField label={t("fieldOrgName")} htmlFor="set-name">
        <input
          id="set-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={authInputStyle(false)}
        />
      </AuthField>
      <AuthField
        label={t("fieldDescription")}
        htmlFor="set-desc"
        hint={t("fieldDescriptionHint")}
      >
        <textarea
          id="set-desc"
          value={description}
          maxLength={600}
          rows={5}
          onChange={(e) => setDescription(e.target.value)}
          style={{
            ...authInputStyle(false),
            padding: "12px 14px",
            resize: "vertical",
            minHeight: "120px",
          }}
        />
      </AuthField>
      <AuthField label={t("fieldWebsite")} htmlFor="set-web">
        <input
          id="set-web"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t("fieldWebsitePlaceholder")}
          style={authInputStyle(false)}
        />
      </AuthField>
    </Section>
  );
}

// ── Specialties ───────────────────────────────────────────────────────────

function SpecialtiesSection({
  initial,
  onSaved,
  locale,
}: {
  initial: string[];
  onSaved: () => Promise<void>;
  locale: "hu" | "en";
}) {
  const t = useTranslations("contractorOnboarding");
  const [chosen, setChosen] = useState<Set<string>>(new Set(initial));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(slug: string) {
    const next = new Set(chosen);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setChosen(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contractor/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "specialties",
          specialties: Array.from(chosen),
        }),
      });
      if (!res.ok) {
        setError(t("saveFailed"));
        return;
      }
      setSavedAt(new Date());
      await onSaved();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t("stepSpecialtiesTitle")}
      subtitle={t("stepSpecialtiesSubtitle")}
      savedAt={savedAt}
      saving={saving}
      error={error}
      onSave={save}
    >
      <div className="grid grid-cols-2 gap-2">
        {SPECIALTIES.map((s) => (
          <Pill
            key={s.slug}
            checked={chosen.has(s.slug)}
            label={locale === "en" ? s.en : s.hu}
            onChange={() => toggle(s.slug)}
          />
        ))}
      </div>
    </Section>
  );
}

// ── Regions ───────────────────────────────────────────────────────────────

function RegionsSection({
  initial,
  onSaved,
  locale,
}: {
  initial: string[];
  onSaved: () => Promise<void>;
  locale: "hu" | "en";
}) {
  const t = useTranslations("contractorOnboarding");
  const [chosen, setChosen] = useState<Set<string>>(new Set(initial));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budapest = REGIONS.filter((r) => r.code.startsWith("BP-"));
  const counties = REGIONS.filter((r) => !r.code.startsWith("BP-"));

  function toggle(code: string) {
    const next = new Set(chosen);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setChosen(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contractor/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regions",
          regions: Array.from(chosen),
        }),
      });
      if (!res.ok) {
        setError(t("saveFailed"));
        return;
      }
      setSavedAt(new Date());
      await onSaved();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title={t("stepRegionsTitle")}
      subtitle={t("stepRegionsSubtitle")}
      savedAt={savedAt}
      saving={saving}
      error={error}
      onSave={save}
    >
      <SubHeader label={t("regionsBudapest")} />
      {/* eslint-disable-next-line responsive/mobile-first -- short district codes (I, II, III...) fit 3 per row at 360px */}
      <div className="grid grid-cols-3 gap-1.5" style={{ marginBottom: "16px" }}>
        {budapest.map((r) => (
          <Pill
            key={r.code}
            compact
            checked={chosen.has(r.code)}
            label={r.code.replace("BP-", "")}
            title={locale === "en" ? r.en : r.hu}
            onChange={() => toggle(r.code)}
          />
        ))}
      </div>
      <SubHeader label={t("regionsCountry")} />
      <div className="grid grid-cols-2 gap-1.5">
        {counties.map((r) => (
          <Pill
            key={r.code}
            checked={chosen.has(r.code)}
            label={locale === "en" ? r.en : r.hu}
            onChange={() => toggle(r.code)}
          />
        ))}
      </div>
    </Section>
  );
}

// ── Documents ─────────────────────────────────────────────────────────────

function DocumentsSection({
  docs,
  onChange,
}: {
  docs: ContractorDocDTO[];
  onChange: () => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  return (
    <Section
      title={t("stepDocumentsTitle")}
      subtitle={t("stepDocumentsSubtitle")}
      savedAt={null}
      saving={false}
      error={null}
      onSave={null}
    >
      <div className="flex flex-col gap-3">
        <DocUploader
          kind="insurance"
          label={t("uploadInsurance")}
          onUploaded={onChange}
        />
        <DocUploader
          kind="license"
          label={t("uploadLicense")}
          onUploaded={onChange}
        />
        <DocUploader
          kind="reference"
          label={t("uploadReference")}
          onUploaded={onChange}
        />
      </div>
      <div
        className="rounded-xl border"
        style={{
          marginTop: "20px",
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
              <DocRow key={d.id} doc={d} onDeleted={onChange} />
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function DocUploader({
  kind,
  label,
  onUploaded,
}: {
  kind: "insurance" | "license" | "reference" | "other";
  label: string;
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

  const id = `set-up-${kind}`;
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4"
      style={{
        padding: "12px 14px",
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
            fontSize: "13.5px",
            fontWeight: 500,
            color: "var(--color-ink)",
          }}
        >
          {label}
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
          {uploading ? t("uploadingLabel") : error ? error : t("uploadDrop")}
        </span>
      </div>
      <input
        id={id}
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

function DocRow({
  doc,
  onDeleted,
}: {
  doc: ContractorDocDTO;
  onDeleted: () => Promise<void>;
}) {
  const t = useTranslations("contractorOnboarding");
  async function handleDelete() {
    const res = await fetch(`/api/contractor/onboarding/documents/${doc.id}`, {
      method: "DELETE",
    });
    if (res.ok) await onDeleted();
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
        background: "color-mix(in srgb, var(--color-moss) 8%, transparent)",
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
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-danger)",
          textDecoration: "underline",
          letterSpacing: "0.04em",
        }}
      >
        {t("deleteDoc")}
      </button>
    </li>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  savedAt,
  saving,
  error,
  onSave,
  children,
}: {
  title: string;
  subtitle: string;
  savedAt: Date | null;
  saving: boolean;
  error: string | null;
  onSave: (() => Promise<void>) | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("contractorOnboarding");
  return (
    <section
      className="rounded-xl border"
      style={{
        marginBottom: "16px",
        padding: "24px 24px 20px",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: "var(--color-bg-3)",
      }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "20px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        {savedAt && (
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-good)",
              letterSpacing: "0.04em",
            }}
          >
            {t("settingsSavedHint", {
              time: savedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
        )}
      </div>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "13.5px",
          margin: "0 0 18px",
        }}
      >
        {subtitle}
      </p>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md border px-3 py-2 text-sm"
          style={{
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
            fontSize: "12.5px",
          }}
        >
          {error}
        </div>
      )}
      {children}
      {onSave && (
        <div className="flex justify-end" style={{ marginTop: "16px" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {saving ? "…" : t("save")}
          </button>
        </div>
      )}
    </section>
  );
}

function Pill({
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
        background: checked ? "var(--color-ink)" : "var(--color-bg)",
        color: checked ? "var(--color-bg)" : "var(--color-ink)",
        cursor: "pointer",
      }}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}

function SubHeader({ label }: { label: string }) {
  return (
    <span
      className="font-mono block"
      style={{
        fontSize: "11px",
        color: "var(--color-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: "8px",
      }}
    >
      {label}
    </span>
  );
}
