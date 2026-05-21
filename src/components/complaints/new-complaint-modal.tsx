"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createComplaint } from "@/app/actions/complaints";
import { uploadFile } from "@/lib/upload";
import type { ComplaintCategoryRef } from "@/lib/dal";

interface UnitOption {
  id: string;
  number: string;
  stairwell: string | null;
  floor: number;
}

interface PendingPhoto {
  name: string;
  url: string;
  size: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  categories: ComplaintCategoryRef[];
  units: UnitOption[];
  locale: string;
}

export function NewComplaintModal({
  open,
  onClose,
  categories,
  units,
  locale,
}: Props) {
  const t = useTranslations("complaints");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [categoryId, setCategoryId] = useState<string>(
    categories[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [respondentUnitId, setRespondentUnitId] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      try {
        const stored = await uploadFile(f, "complaint-photo");
        setPhotos((prev) => [
          ...prev,
          { name: stored.fileName, url: stored.url, size: stored.fileSize },
        ]);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Upload failed: ${f.name}`,
        );
      }
    }
  }

  async function submit() {
    if (submitting || !categoryId || !description.trim()) return;
    setSubmitting(true);
    try {
      const result = await createComplaint({
        categoryId,
        title: title.trim() || undefined,
        description: description.trim(),
        photos,
        isPrivate,
        respondentUnitId: respondentUnitId || undefined,
      });
      if (result.error) throw new Error(result.error);
      onClose();
      if (result.id) {
        router.push(`/${locale}/complaints/${result.id}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{
        background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
        padding: "20px",
      }}
      onClick={() => !submitting && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "var(--color-card)",
          borderRadius: "16px",
          padding: "24px 26px",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: "16px",
          }}
        >
          {t("form.modalTitle")}
        </h2>

        {/* Category picker */}
        <FieldLabel>{t("form.category")}</FieldLabel>
        <div className="flex flex-wrap gap-1.5" style={{ marginBottom: "16px" }}>
          {categories.map((c) => {
            const isOn = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className="font-mono inline-flex items-center gap-1.5"
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  borderRadius: "999px",
                  background: isOn ? "var(--color-ink)" : "var(--color-bg-3)",
                  color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                  border: 0,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  fontWeight: isOn ? 600 : 500,
                }}
              >
                {c.icon && <span aria-hidden>{c.icon}</span>}
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Title */}
        <FieldLabel>{t("form.title")}</FieldLabel>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("form.titlePh")}
          style={{
            width: "100%",
            background: "var(--color-bg)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "14px",
            fontWeight: 500,
            outline: "none",
            marginBottom: "14px",
          }}
        />

        {/* Description */}
        <FieldLabel>{t("form.description")}</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("form.descriptionPh")}
          rows={4}
          style={{
            width: "100%",
            background: "var(--color-bg)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "13.5px",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            marginBottom: "14px",
          }}
        />

        {/* Photos */}
        <FieldLabel>{t("form.photos")}</FieldLabel>
        <div
          className="flex flex-wrap items-center gap-2"
          style={{ marginBottom: "14px" }}
        >
          <button
            type="button"
            onClick={pickFile}
            className="font-mono"
            style={{
              padding: "6px 12px",
              fontSize: "11px",
              borderRadius: "8px",
              background: "var(--color-bg-3)",
              color: "var(--color-ink-soft)",
              border:
                "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {t("form.addPhoto")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          {photos.map((p, i) => (
            <span
              key={i}
              className="font-mono inline-flex items-center gap-1.5"
              style={{
                fontSize: "10px",
                padding: "3px 8px",
                borderRadius: "999px",
                background: "var(--color-bg-3)",
                color: "var(--color-ink-soft)",
                letterSpacing: "0.04em",
              }}
            >
              📷 {p.name}
              <button
                type="button"
                onClick={() =>
                  setPhotos((prev) => prev.filter((_, j) => j !== i))
                }
                aria-label="remove"
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--color-muted)",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Respondent unit (optional) */}
        <FieldLabel>{t("form.respondent")}</FieldLabel>
        <select
          value={respondentUnitId}
          onChange={(e) => setRespondentUnitId(e.target.value)}
          style={{
            width: "100%",
            background: "var(--color-bg)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "13.5px",
            outline: "none",
            marginBottom: "14px",
          }}
        >
          <option value="">{t("form.respondentNone")}</option>
          {units.map((u) => {
            const label = `${u.stairwell ? u.stairwell + "/" : ""}${u.number}`;
            return (
              <option key={u.id} value={u.id}>
                {t("form.respondentLabel", {
                  label,
                  floor: u.floor.toString(),
                })}
              </option>
            );
          })}
        </select>

        {/* Privacy */}
        <label
          className="flex items-start gap-2"
          style={{
            padding: "12px",
            background: isPrivate
              ? "color-mix(in srgb, var(--color-ochre) 10%, transparent)"
              : "var(--color-bg-3)",
            borderRadius: "10px",
            border: isPrivate
              ? "1px solid color-mix(in srgb, var(--color-ochre) 30%, transparent)"
              : "1px solid transparent",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>
              {t("form.privacyTitle")}
            </div>
            <div
              style={{
                fontSize: "11.5px",
                color: "var(--color-ink-soft)",
                marginTop: "2px",
              }}
            >
              {t("form.privacyDesc")}
            </div>
          </div>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "9px 14px",
              fontSize: "12.5px",
              fontWeight: 500,
              borderRadius: "8px",
              background: "transparent",
              color: "var(--color-ink)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
              cursor: "pointer",
            }}
          >
            {t("detail.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !categoryId || !description.trim()}
            className="transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{
              padding: "9px 18px",
              fontSize: "12.5px",
              fontWeight: 600,
              borderRadius: "8px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: 0,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? t("form.submitting") : t("form.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="font-mono block"
      style={{
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: "6px",
        fontWeight: 600,
      }}
    >
      {children}
    </label>
  );
}
