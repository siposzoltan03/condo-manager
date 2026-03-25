"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface NewTopicFormProps {
  categories: Category[];
  defaultCategoryId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewTopicForm({
  categories,
  defaultCategoryId,
  onClose,
  onSuccess,
}: NewTopicFormProps) {
  const t = useTranslations("forum");
  const tCommon = useTranslations("common");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !categoryId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), categoryId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create topic");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-manrope text-xl font-bold text-[#002045]">
            {t("createTopic")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("topicCategory")}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("topicTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("topicBody")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="rounded-xl bg-[#002045] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001530] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? tCommon("loading") : tCommon("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
