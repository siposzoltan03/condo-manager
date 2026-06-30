"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function SecurityTab() {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError(tSettings("passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(tSettings("passwordMismatch"));
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }

      setSuccess(tSettings("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-ink">{tSettings("changePassword")}</h3>
        <p className="mt-1 text-sm text-muted">
          {tSettings("changePasswordDesc")}
        </p>
      </div>

      {/* Current Password */}
      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1.5">
          {tSettings("currentPassword")}
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full max-w-md rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          placeholder="Enter current password"
        />
      </div>

      {/* New Password */}
      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1.5">
          {tSettings("newPassword")}
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="w-full max-w-md rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          placeholder="At least 8 characters"
        />
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-ink-soft mb-1.5">
          {tSettings("confirmPassword")}
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full max-w-md rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          placeholder="Re-enter new password"
        />
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

      {/* Submit */}
      <div>
        <button
          type="submit"
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="rounded-lg bg-blue px-6 py-2.5 text-sm font-medium text-card hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t("loading") : tSettings("changePassword")}
        </button>
      </div>
    </form>
  );
}
