"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateMeetingModal({ onClose, onCreated }: Props) {
  const t = useTranslations("voting");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title || !date || !time) {
      setError(t("missingFields"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/voting/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          date,
          time,
          location: location || null,
        }),
      });

      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error || t("createFailed"));
      }
    } catch {
      setError(t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#002045]">{t("createMeeting")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("meetingTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {t("meetingDate")}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {t("meetingTime")}
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("meetingLocation")}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("locationPlaceholder")}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
            >
              {submitting ? t("creating") : t("createMeeting")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
