"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

interface CategoryOption {
  id: string;
  name: string;
  isChild: boolean;
}

interface Props {
  open: boolean;
  parents: CategoryOption[];
  onClose: () => void;
  onCreated: () => void;
}

export function NewCategoryModal({ open, parents, onClose, onCreated }: Props) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
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
    setName("");
    setParentId("");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: t("modal.required") });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/documents/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: parentId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || tCommon("error") });
        return;
      }
      toast.success(t("category.created"));
      reset();
      onCreated();
    } catch {
      setErrors({ submit: tCommon("error") });
      toast.error(tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  // Only top-level categories can be parents (avoid 3-level deep trees).
  const topLevelParents = parents.filter((c) => !c.isChild);

  return (
    <VotingModalShell
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      eyebrow={t("category.eyebrow")}
      title={t("category.title")}
      subtitle={t("category.subtitle")}
      accent="moss"
      maxWidth={460}
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
          label={t("category.nameLabel")}
          htmlFor="cat-name"
          error={errors.name}
        >
          <input
            id="cat-name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            placeholder={t("category.namePlaceholder")}
            style={votingInputStyle(!!errors.name)}
          />
        </VotingField>

        <VotingField
          label={t("category.parentLabel")}
          htmlFor="cat-parent"
          hint={t("category.parentHint")}
        >
          <select
            id="cat-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            style={votingInputStyle(false)}
          >
            <option value="">{t("category.parentNone")}</option>
            {topLevelParents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
            {submitting ? tCommon("loading") : t("category.createCta")}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}
