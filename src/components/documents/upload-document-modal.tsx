"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

interface Category {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

interface UploadDocumentModalProps {
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadDocumentModal({ categories, onClose, onSuccess }: UploadDocumentModalProps) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Flatten categories for select
  const flatCategories: { id: string; name: string; isChild: boolean }[] = [];
  for (const cat of categories) {
    flatCategories.push({ id: cat.id, name: cat.name, isChild: false });
    for (const child of cat.children) {
      flatCategories.push({ id: child.id, name: child.name, isChild: true });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !categoryId || !fileName) {
      setError(t("missingFields"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      // For now, fileUrl is a placeholder since we don't have file storage yet
      const fileUrl = `/uploads/${Date.now()}-${fileName}`;
      const mimeType = guessMimeType(fileName);

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          categoryId,
          visibility,
          fileName,
          fileUrl,
          fileSize: 0,
          mimeType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create document");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">{t("uploadDocument")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("docTitle")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("docTitlePlaceholder")}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("docDescription")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("docDescriptionPlaceholder")}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("docCategory")}</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
            >
              <option value="">{t("selectCategory")}</option>
              {flatCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.isChild ? `  \u2014 ${cat.name}` : cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("docVisibility")}</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
            >
              <option value="PUBLIC">{t("visibilityPublic")}</option>
              <option value="BOARD_ONLY">{t("visibilityBoardOnly")}</option>
              <option value="ADMIN_ONLY">{t("visibilityAdminOnly")}</option>
            </select>
          </div>

          {/* File name (simulated upload) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("file")}</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm text-slate-500">{t("dropFileHere")}</p>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder={t("fileNamePlaceholder")}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#002045]"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#002045] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#001530] disabled:opacity-50"
            >
              {saving ? tCommon("loading") : t("uploadDocument")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    default:
      return "application/octet-stream";
  }
}
