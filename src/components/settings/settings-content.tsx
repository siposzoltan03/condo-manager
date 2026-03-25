"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { User, Bell, Shield } from "lucide-react";
import { ProfileTab } from "./profile-tab";
import { NotificationsTab } from "./notifications-tab";
import { SecurityTab } from "./security-tab";

interface ProfileData {
  name: string;
  email: string;
  role: string;
  language: string;
  notificationPreferences: Record<string, unknown>;
  unit: { number: string } | null;
}

type Tab = "profile" | "notifications" | "security";

const TAB_CONFIGS: { key: Tab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", labelKey: "profile", icon: User },
  { key: "notifications", labelKey: "notifications", icon: Bell },
  { key: "security", labelKey: "security", icon: Shield },
];

export function SettingsContent() {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setProfile(data);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-center">
          <p className="text-sm text-red-700">{error || t("error")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{tSettings("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tSettings("subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Tab navigation (left side on desktop, top on mobile) */}
        <nav className="flex lg:flex-col gap-1 lg:w-56 lg:shrink-0">
          {TAB_CONFIGS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors text-left ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden sm:inline">{tSettings(tab.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          {activeTab === "profile" && (
            <ProfileTab profile={profile} onUpdate={fetchProfile} />
          )}
          {activeTab === "notifications" && (
            <NotificationsTab
              preferences={profile.notificationPreferences as Record<string, unknown>}
              onUpdate={fetchProfile}
            />
          )}
          {activeTab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
