"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

const CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "COMMON_AREA",
  "ELEVATOR",
  "HEATING",
  "OTHER",
] as const;

const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

interface ReportIssueModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function ReportIssueModal({ onClose, onCreated }: ReportIssueModalProps) {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successTrackingNumber, setSuccessTrackingNumber] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim() || !description.trim() || !category || !urgency) {
      setError(t("missingFields"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          urgency,
          location: location.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || tCommon("error"));
        return;
      }

      const data = await res.json();
      setSuccessTrackingNumber(data.trackingNumber);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  if (successTrackingNumber) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl text-center">
          <div className="mb-4 text-4xl">&#10003;</div>
          <h2 className="mb-2 text-lg font-semibold text-[#002045]">
            {t("ticketCreated")}
          </h2>
          <p className="mb-2 text-sm text-slate-600">{t("trackingNumber")}:</p>
          <p className="mb-6 font-mono text-xl font-bold text-[#002045]">
            {successTrackingNumber}
          </p>
          <button
            onClick={() => {
              onCreated();
            }}
            className="rounded-md bg-[#002045] px-6 py-2 text-sm font-medium text-white hover:bg-[#002045]/90"
          >
            {tCommon("success")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-[#002045]">
            {t("reportIssue")}
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
              {t("ticketTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("descriptionPlaceholder")}
              required
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("urgencyLabel")}
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                required
              >
                <option value="">{t("selectUrgency")}</option>
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {t(`urgency_${u}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("location")}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              placeholder={t("locationPlaceholder")}
            />
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
