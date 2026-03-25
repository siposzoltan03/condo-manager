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

const EVENT_TYPE_KEYS = [
  "announcements",
  "messages",
  "maintenance",
  "payments",
  "voting",
] as const;

type DeliveryMethod = "email" | "push" | "none";

const DELIVERY_METHODS: DeliveryMethod[] = ["email", "push", "none"];

export function NotificationsTab({ preferences, onUpdate }: NotificationsTabProps) {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
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
        <h3 className="text-lg font-semibold text-slate-900">{tSettings("notifTitle")}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {tSettings("notifDesc")}
        </p>
      </div>

      {/* Notification table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-3.5 text-left font-semibold text-slate-700">
                {tSettings("eventType")}
              </th>
              {DELIVERY_METHODS.map((method) => (
                <th
                  key={method}
                  className="px-6 py-3.5 text-center font-semibold text-slate-700"
                >
                  {tSettings(`delivery_${method}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EVENT_TYPE_KEYS.map((eventKey) => {
              const currentMethod =
                (prefs[eventKey as keyof NotificationPreferences] as string) || "email";
              return (
                <tr key={eventKey} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {tSettings(eventKey)}
                  </td>
                  {DELIVERY_METHODS.map((method) => {
                    const isPush = method === "push";
                    return (
                      <td key={method} className="px-6 py-4 text-center">
                        <span
                          className={isPush ? "inline-flex flex-col items-center gap-0.5" : undefined}
                          title={isPush ? tSettings("pushComingSoon") : undefined}
                        >
                          <input
                            type="radio"
                            name={`notif-${eventKey}`}
                            value={method}
                            checked={currentMethod === method}
                            onChange={() => handleMethodChange(eventKey, method)}
                            disabled={isPush}
                            className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                          {isPush && (
                            <span className="text-[10px] text-slate-400 leading-tight">
                              {tSettings("pushComingSoon")}
                            </span>
                          )}
                        </span>
                      </td>
                    );
                  })}
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
          <p className="text-sm font-medium text-slate-900">{tSettings("dailyDigest")}</p>
          <p className="text-xs text-slate-500">
            {tSettings("dailyDigestDesc")}
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
