"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface ProfileData {
  name: string;
  email: string;
  role: string;
  language: string;
  unit: { number: string } | null;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  ADMIN: "bg-purple-100 text-purple-800",
  BOARD_MEMBER: "bg-blue-100 text-blue-800",
  RESIDENT: "bg-green-100 text-green-800",
  TENANT: "bg-slate-100 text-slate-700",
};

const ROLE_TO_I18N_KEY: Record<string, string> = {
  SUPER_ADMIN: "roleSuperAdmin",
  ADMIN: "roleAdmin",
  BOARD_MEMBER: "roleBoardMember",
  RESIDENT: "roleResident",
  TENANT: "roleTenant",
};

interface ProfileTabProps {
  profile: ProfileData;
  onUpdate: () => void;
}

export function ProfileTab({ profile, onUpdate }: ProfileTabProps) {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
  const [name, setName] = useState(profile.name);
  const [language, setLanguage] = useState(profile.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, language }),
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

  const hasChanges = name !== profile.name || language !== profile.language;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{tSettings("profileInfo")}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {tSettings("profileDesc")}
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {tSettings("name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t("email")}
        </label>
        <input
          type="email"
          value={profile.email}
          disabled
          className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
        />
        <p className="mt-1 text-xs text-slate-400">
          {tSettings("emailReadonly")}
        </p>
      </div>

      {/* Unit (read-only) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {tSettings("unitNumber")}
        </label>
        <input
          type="text"
          value={profile.unit?.number ?? "-"}
          disabled
          className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
        />
      </div>

      {/* Role (read-only badge) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {tSettings("role")}
        </label>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            ROLE_COLORS[profile.role] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          {ROLE_TO_I18N_KEY[profile.role]
            ? tSettings(ROLE_TO_I18N_KEY[profile.role] as Parameters<typeof tSettings>[0])
            : profile.role}
        </span>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {tSettings("language")}
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="hu">Magyar</option>
          <option value="en">English</option>
        </select>
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
          type="submit"
          disabled={saving || !hasChanges}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t("loading") : t("save")}
        </button>
      </div>
    </form>
  );
}
