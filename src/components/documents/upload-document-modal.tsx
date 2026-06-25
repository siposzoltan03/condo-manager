"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createDocument } from "@/app/actions/documents";
import { uploadFile } from "@/lib/upload";
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
  categories: CategoryOption[];
  defaultCategoryId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

const VISIBILITIES = ["PUBLIC", "BOARD_ONLY", "ADMIN_ONLY"] as const;

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
    }[ext] ?? "application/octet-stream"
  );
}

export function UploadDocumentModal({
  open,
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: Props) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]>(
    "PUBLIC",
  );
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
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
    setCategoryId(defaultCategoryId ?? "");
    setVisibility("PUBLIC");
    setFile(null);
    setExpiresAt("");
    setErrors({});
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("modal.required");
    if (!categoryId) errs.categoryId = t("modal.required");
    if (!file) errs.file = t("modal.fileRequired");
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
      if (!file) return;
      let stored;
      try {
        stored = await uploadFile(file, "document");
      } catch (err) {
        setErrors({
          submit: err instanceof Error ? err.message : "Upload failed",
        });
        return;
      }
      const mimeType = stored.mimeType || guessMimeType(file.name);

      const result = await createDocument({
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId,
        visibility,
        fileName: stored.fileName,
        fileUrl: stored.url,
        fileSize: stored.fileSize,
        mimeType,
        expiresAt: expiresAt || null,
      });

      if (result.error) {
        setErrors({ submit: result.error });
        return;
      }
      toast.success(t("modal.uploaded"));
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
      eyebrow={t("modal.uploadEyebrow")}
      title={t("modal.uploadTitle")}
      subtitle={t("modal.uploadSubtitle")}
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
          label={t("modal.fileLabel")}
          htmlFor="upload-file"
          error={errors.file}
          hint={file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : t("modal.fileHint")}
        >
          <label
            htmlFor="upload-file"
            className="flex items-center justify-center"
            style={{
              padding: "16px",
              border: errors.file
                ? "1px dashed var(--color-danger)"
                : "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
              borderRadius: "8px",
              background: file
                ? "color-mix(in srgb, var(--color-moss-2) 8%, var(--color-bg-3))"
                : "var(--color-bg-3)",
              fontSize: "12.5px",
              color: file ? "var(--color-moss)" : "var(--color-ink-soft)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {file ? `✓ ${file.name}` : t("modal.fileDrop")}
            <input
              id="upload-file"
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                clearError("file");
              }}
              style={{ display: "none" }}
            />
          </label>
        </VotingField>

        <VotingField
          label={t("modal.titleLabel")}
          htmlFor="upload-title"
          error={errors.title}
        >
          <input
            id="upload-title"
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

        <VotingField label={t("modal.descriptionLabel")} htmlFor="upload-desc">
          <textarea
            id="upload-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t("modal.descriptionPlaceholder")}
            style={{
              ...votingInputStyle(false),
              resize: "vertical",
              minHeight: "60px",
            }}
          />
        </VotingField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VotingField
            label={t("modal.categoryLabel")}
            htmlFor="upload-category"
            error={errors.categoryId}
          >
            <select
              id="upload-category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                clearError("categoryId");
              }}
              style={votingInputStyle(!!errors.categoryId)}
            >
              <option value="">{t("modal.categorySelect")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isChild ? "— " : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </VotingField>
          <VotingField
            label={t("modal.visibilityLabel")}
            htmlFor="upload-visibility"
          >
            <select
              id="upload-visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as (typeof VISIBILITIES)[number])
              }
              style={votingInputStyle(false)}
            >
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`visibility.${v}`)}
                </option>
              ))}
            </select>
          </VotingField>
        </div>

        <VotingField
          label={t("modal.expiresLabel")}
          htmlFor="upload-expires"
          hint={t("modal.expiresHint")}
        >
          <input
            id="upload-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            style={votingInputStyle(false)}
          />
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
            {submitting ? tCommon("loading") : t("modal.uploadCta")}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}
