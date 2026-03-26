"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface AnnouncementFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AnnouncementForm({ onClose, onSuccess }: AnnouncementFormProps) {
  const t = useTranslations("announcements");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), targetAudience }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create announcement");
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-manrope text-xl font-bold text-[#002045]">
            {t("newAnnouncement")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="ann-title"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("createTitle")}
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("createTitle")}
            />
          </div>

          {/* Body */}
          <div>
            <label
              htmlFor="ann-body"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("createBody")}
            </label>
            <textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={5}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("createBody")}
            />
          </div>

          {/* Audience */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t("createAudience")}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value="ALL"
                  checked={targetAudience === "ALL"}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="h-4 w-4 text-[#002045] focus:ring-[#002045]"
                />
                <span className="text-sm text-slate-700">{t("audienceAll")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value="BOARD_ONLY"
                  checked={targetAudience === "BOARD_ONLY"}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="h-4 w-4 text-[#002045] focus:ring-[#002045]"
                />
                <span className="text-sm text-slate-700">
                  {t("audienceBoardOnly")}
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="rounded-xl bg-[#002045] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#001530] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? tCommon("loading") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
