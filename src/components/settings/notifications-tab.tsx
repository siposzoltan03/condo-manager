"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface NotificationPreferences {
  announcements?: string;
  messages?: string;
  maintenance?: string;
  payments?: string;
  voting?: string;
  dailyDigest?: boolean;
}

interface NotificationsTabProps {
  preferences: NotificationPreferences;
  onUpdate: () => void;
}

const EVENT_TYPES = [
  { key: "announcements", label: "Announcements" },
  { key: "messages", label: "Messages" },
  { key: "maintenance", label: "Maintenance" },
  { key: "payments", label: "Payments" },
  { key: "voting", label: "Voting" },
] as const;

type DeliveryMethod = "email" | "push" | "none";

const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "none", label: "None" },
];

export function NotificationsTab({ preferences, onUpdate }: NotificationsTabProps) {
  const t = useTranslations("common");
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...preferences });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleMethodChange(eventKey: string, method: DeliveryMethod) {
    setPrefs((prev) => ({ ...prev, [eventKey]: method }));
  }

  function handleDigestToggle() {
    setPrefs((prev) => ({ ...prev, dailyDigest: !prev.dailyDigest }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPreferences: prefs }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSuccess(t("success"));
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Notification Preferences</h3>
        <p className="mt-1 text-sm text-slate-500">
          Choose how you want to be notified for each type of event.
        </p>
      </div>

      {/* Notification table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-3.5 text-left font-semibold text-slate-700">
                Event Type
              </th>
              {DELIVERY_OPTIONS.map((opt) => (
                <th
                  key={opt.value}
                  className="px-6 py-3.5 text-center font-semibold text-slate-700"
                >
                  {opt.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EVENT_TYPES.map((event) => {
              const currentMethod =
                (prefs[event.key as keyof NotificationPreferences] as string) || "email";
              return (
                <tr key={event.key} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {event.label}
                  </td>
                  {DELIVERY_OPTIONS.map((opt) => (
                    <td key={opt.value} className="px-6 py-4 text-center">
                      <input
                        type="radio"
                        name={`notif-${event.key}`}
                        value={opt.value}
                        checked={currentMethod === opt.value}
                        onChange={() => handleMethodChange(event.key, opt.value)}
                        className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Daily Digest Toggle */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          role="switch"
          aria-checked={!!prefs.dailyDigest}
          onClick={handleDigestToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            prefs.dailyDigest ? "bg-blue-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
              prefs.dailyDigest ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-slate-900">Daily Digest</p>
          <p className="text-xs text-slate-500">
            Receive a single daily summary email instead of individual notifications.
          </p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Save */}
      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    </div>
  );
}
