"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Lock } from "lucide-react";

const CATEGORIES = [
  "NOISE",
  "DAMAGE",
  "SAFETY",
  "PARKING",
  "OTHER",
] as const;

interface ComplaintFormProps {
  onClose: () => void;
  onCreated: () => void;
}

export function ComplaintFormModal({ onClose, onCreated }: ComplaintFormProps) {
  const t = useTranslations("complaints");
  const tCommon = useTranslations("common");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!category || !description.trim()) {
      setError(t("missingFields"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          isPrivate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || tCommon("error"));
        return;
      }

      onCreated();
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-[#002045]">
            {t("submitComplaint")}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("category")}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            >
              <option value="">{t("selectCategory")}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`category_${cat}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("descriptionPlaceholder")}
              required
            />
          </div>

          <div className="mb-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                isPrivate
                  ? "border-[#002045] bg-[#002045]/5 text-[#002045]"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <Lock className="h-4 w-4" />
              {t("privateComplaint")}
            </button>
            <span className="text-xs text-slate-500">
              {t("privateHint")}
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
            >
              {loading ? tCommon("loading") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
