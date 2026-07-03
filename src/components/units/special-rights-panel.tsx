"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createSpecialRight, deleteSpecialRight } from "@/app/actions/special-rights";
import { useConfirm } from "@/components/shared/confirm-dialog";

const KINDS = ["EXCLUSIVE_USE", "PRE_EMPTION", "PARKING", "STORAGE", "OTHER"] as const;
type Kind = (typeof KINDS)[number];

export interface SpecialRightItem {
  id: string;
  kind: Kind;
  description: string;
  location: string | null;
  areaSize: number | null;
  sourceSection: string | null;
  sourceVersionId: string | null;
  unit: { id: string; number: string } | null;
}

/**
 * Founding-deed special rights (különleges jogok) register — read for board+,
 * add/remove for units.manage holders. Rights recorded from the deed carry a
 * source badge; manually-added ones don't.
 */
export function SpecialRightsPanel({
  rights,
  units,
}: {
  rights: SpecialRightItem[];
  units: { id: string; number: string }[];
}) {
  const t = useTranslations("units.specialRights");
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Kind>("EXCLUSIVE_USE");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");

  async function onAdd() {
    if (!description.trim()) {
      toast.error(t("descRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await createSpecialRight({
        kind,
        description,
        unitId: unitId || null,
        location: location || null,
        areaSize: area ? Number(area) : null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("added"));
      setAdding(false);
      setDescription("");
      setUnitId("");
      setLocation("");
      setArea("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    const ok = await confirm({ title: t("deleteConfirm"), danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await deleteSpecialRight({ id });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deleted"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "24px",
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "20px 22px",
      }}
    >
      <div className="flex justify-between items-center gap-3" style={{ marginBottom: "4px" }}>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {t("title")}
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          disabled={busy}
          style={{
            padding: "7px 13px",
            fontSize: "12.5px",
            fontWeight: 600,
            borderRadius: "8px",
            background: adding ? "var(--color-bg-3)" : "var(--color-ink)",
            color: adding ? "var(--color-ink)" : "var(--color-bg)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {adding ? t("cancel") : t("addCta")}
        </button>
      </div>
      <p style={{ color: "var(--color-muted)", fontSize: "12.5px", marginBottom: "14px", maxWidth: "70ch" }}>
        {t("desc")}
      </p>

      {adding && (
        <div
          className="rounded-lg"
          style={{
            marginBottom: "16px",
            padding: "14px 16px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px 14px",
            alignItems: "end",
          }}
        >
          <Field label={t("fieldKind")}>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} style={inputStyle}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("fieldUnit")}>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={inputStyle}>
              <option value="">{t("unitNone")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("fieldLocation")}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} placeholder="P-12" />
          </Field>
          <Field label={t("fieldArea")}>
            <input value={area} onChange={(e) => setArea(e.target.value)} type="number" min="0" step="0.01" style={inputStyle} />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label={t("fieldDescription")}>
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} placeholder={t("descPlaceholder")} />
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, borderRadius: "8px", background: "var(--color-ink)", color: "var(--color-bg)", border: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {t("save")}
            </button>
          </div>
        </div>
      )}

      {rights.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--color-muted)" }}>{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rights.map((r) => (
            <div
              key={r.id}
              className="flex justify-between items-start gap-3"
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background: "var(--color-bg-3)",
                      color: "var(--color-ink-soft)",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t(`kind.${r.kind}`)}
                  </span>
                  {r.unit && (
                    <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{r.unit.number}</span>
                  )}
                  {r.location && (
                    <span style={{ fontSize: "12px", color: "var(--color-ink-soft)" }}>· {r.location}</span>
                  )}
                  {r.areaSize != null && (
                    <span style={{ fontSize: "12px", color: "var(--color-ink-soft)" }}>· {r.areaSize} m²</span>
                  )}
                  {r.sourceVersionId ? (
                    <span
                      className="font-mono"
                      style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "3px", background: "var(--color-good-soft)", color: "var(--color-good)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
                      title={r.sourceSection ?? undefined}
                    >
                      {t("fromDeed")}
                    </span>
                  ) : (
                    <span
                      className="font-mono"
                      style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "3px", background: "var(--color-bg-3)", color: "var(--color-muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
                    >
                      {t("manual")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "13px", color: "var(--color-ink-soft)", marginTop: "4px", lineHeight: 1.45 }}>
                  {r.description}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(r.id)}
                disabled={busy}
                style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, borderRadius: "8px", background: "var(--color-card)", color: "var(--color-danger)", border: "1px solid var(--color-danger-soft)", cursor: busy ? "not-allowed" : "pointer", flexShrink: 0 }}
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  fontSize: "13px",
  border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)",
  background: "var(--color-bg)",
  color: "var(--color-ink)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-mono"
        style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
