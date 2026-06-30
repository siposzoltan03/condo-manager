"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from "@/lib/push-client";

interface NotificationPreferences {
  announcements?: string;
  messages?: string;
  maintenance?: string;
  payments?: string;
  voting?: string;
  marketplace?: string;
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
  "marketplace",
] as const;

type DeliveryMethod = "email" | "push" | "both" | "none";

const DELIVERY_METHODS: DeliveryMethod[] = ["email", "push", "both", "none"];

export function NotificationsTab({ preferences, onUpdate }: NotificationsTabProps) {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...preferences });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    isPushSubscribed().then(setPushEnabled);
  }, []);

  async function handleEnablePush() {
    setPushLoading(true);
    setError("");
    try {
      const subscription = await subscribeToPush();
      if (subscription) {
        setPushEnabled(true);
        // Auto-set all event types to "both" (email + push) and save immediately
        const bothPrefs: NotificationPreferences = {};
        for (const key of EVENT_TYPE_KEYS) {
          bothPrefs[key] = "both";
        }
        setPrefs((prev) => ({ ...prev, ...bothPrefs }));
        // Persist to API
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationPreferences: { ...prefs, ...bothPrefs } }),
        });
      } else {
        setError(tSettings("pushPermissionDenied"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setPushLoading(false);
    }
  }

  async function handleDisablePush() {
    setPushLoading(true);
    setError("");
    try {
      await unsubscribeFromPush();
      setPushEnabled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setPushLoading(false);
    }
  }

  async function handleMethodChange(eventKey: string, method: DeliveryMethod) {
    if (method === "push" && !pushEnabled) {
      await handleEnablePush();
      if (!pushEnabled) return;
    }
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
        <h3 className="text-lg font-semibold text-ink">{tSettings("notifTitle")}</h3>
        <p className="mt-1 text-sm text-muted">
          {tSettings("notifDesc")}
        </p>
      </div>

      {/* Push notification status */}
      <div className="flex items-center gap-3 rounded-lg border border-tile-a bg-card px-6 py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">{tSettings("pushNotifications")}</p>
          <p className="text-xs text-muted">
            {pushEnabled ? tSettings("pushEnabledDesc") : tSettings("pushDisabledDesc")}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            pushEnabled
              ? "bg-good/10 text-good"
              : "bg-bg-2 text-ink-soft"
          }`}
        >
          {pushEnabled ? tSettings("pushEnabled") : tSettings("pushDisabled")}
        </span>
        <button
          type="button"
          onClick={pushEnabled ? handleDisablePush : handleEnablePush}
          disabled={pushLoading}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            pushEnabled
              ? "bg-bg-2 text-ink-soft hover:bg-bg-3"
              : "bg-blue text-card hover:bg-blue/90"
          }`}
        >
          {pushLoading
            ? t("loading")
            : pushEnabled
              ? tSettings("pushDisableBtn")
              : tSettings("pushEnableBtn")}
        </button>
      </div>

      {/* Notification table */}
      <div className="overflow-hidden rounded-lg border border-tile-a bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tile-a bg-bg-3">
              <th className="px-6 py-3.5 text-left font-semibold text-ink-soft">
                {tSettings("eventType")}
              </th>
              {DELIVERY_METHODS.map((method) => (
                <th
                  key={method}
                  className="px-6 py-3.5 text-center font-semibold text-ink-soft"
                >
                  {tSettings(`delivery_${method}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-tile-a">
            {EVENT_TYPE_KEYS.map((eventKey) => {
              const currentMethod =
                (prefs[eventKey as keyof NotificationPreferences] as string) || "email";
              return (
                <tr key={eventKey} className="hover:bg-bg-3 transition-colors">
                  <td className="px-6 py-4 font-medium text-ink">
                    {tSettings(eventKey)}
                  </td>
                  {DELIVERY_METHODS.map((method) => (
                    <td key={method} className="px-6 py-4 text-center">
                      <input
                        type="radio"
                        name={`notif-${eventKey}`}
                        value={method}
                        checked={currentMethod === method}
                        onChange={() => handleMethodChange(eventKey, method)}
                        className="h-4 w-4 border-tile-a text-blue focus:ring-blue"
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
      <div className="flex items-center gap-3 rounded-lg border border-tile-a bg-card px-6 py-4">
        <button
          type="button"
          role="switch"
          aria-checked={!!prefs.dailyDigest}
          onClick={handleDigestToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            prefs.dailyDigest ? "bg-blue" : "bg-bg-2"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card shadow-lg transition-transform ${
              prefs.dailyDigest ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-ink">{tSettings("dailyDigest")}</p>
          <p className="text-xs text-muted">
            {tSettings("dailyDigestDesc")}
          </p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-good/10 px-4 py-3 text-sm text-good">
          {success}
        </div>
      )}

      {/* Save */}
      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue px-6 py-2.5 text-sm font-medium text-card hover:bg-blue/90 disabled:opacity-50 transition-colors"
        >
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    </div>
  );
}
