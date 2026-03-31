"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Megaphone,
  Wallet,
  Wrench,
  Vote,
  FileText,
  Bell,
  Building2,
  Users,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Shield,
  BarChart3,
  Calendar,
} from "lucide-react";
import { PublicNav } from "./public-nav";

const features = [
  { key: "announcements", icon: Megaphone },
  { key: "finance", icon: Wallet },
  { key: "maintenance", icon: Wrench },
  { key: "voting", icon: Vote },
  { key: "documents", icon: FileText },
  { key: "notifications", icon: Bell },
] as const;

const detailedFeatures = [
  {
    key: "communication",
    icon: MessageSquare,
    color: "bg-blue-500",
    highlights: ["announcements", "forum", "messaging", "complaints"],
    screenshot: "/screenshots/announcements.png",
  },
  {
    key: "finance",
    icon: BarChart3,
    color: "bg-emerald-500",
    highlights: ["ledger", "charges", "budgets", "reports"],
    screenshot: "/screenshots/finance.png",
  },
  {
    key: "maintenance",
    icon: Wrench,
    color: "bg-amber-500",
    highlights: ["tickets", "contractors", "scheduled", "tracking"],
    screenshot: "/screenshots/maintenance.png",
  },
  {
    key: "voting",
    icon: Shield,
    color: "bg-purple-500",
    highlights: ["weighted", "proxy", "secret", "quorum"],
    screenshot: "/screenshots/voting.png",
  },
  {
    key: "documents",
    icon: FileText,
    color: "bg-cyan-500",
    highlights: ["versioning", "categories", "search", "access"],
    screenshot: "/screenshots/documents.png",
  },
  {
    key: "management",
    icon: Calendar,
    color: "bg-rose-500",
    highlights: ["multiBuilding", "roles", "invitations", "billing"],
    screenshot: "/screenshots/dashboard.png",
  },
] as const;

const stats = [
  { key: "buildingsManaged", value: "500+", icon: Building2 },
  { key: "residentsConnected", value: "12,000+", icon: Users },
  { key: "issuesResolved", value: "35,000+", icon: CheckCircle2 },
] as const;

export function LandingPage() {
  const t = useTranslations("landing");

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#002045] via-[#003060] to-[#004080]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRWMGgySHYzNEgwdi0yaDM0ek0zNiA2MHYtMmgydjJIMHYtMmgzNHoiLz48L2c+PC9nPjwvc3ZnPg==')]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              {t("heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-[#002045] shadow-lg transition hover:bg-slate-100"
              >
                {t("startFreeTrial")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:border-white/50 hover:bg-white/10"
              >
                {t("viewPricing")}
              </a>
            </div>
          </div>
          {/* TODO: Replace with real app screenshots */}
        </div>
      </section>

      {/* Features Overview */}
      <section id="features" className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t("featuresTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              {t("featuresSubtitle")}
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#002045]/10">
                  <Icon className="h-6 w-6 text-[#002045]" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {t(`feature.${key}`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(`feature.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Feature Sections */}
      {detailedFeatures.map((feature, index) => {
        const Icon = feature.icon;
        const isReversed = index % 2 === 1;

        return (
          <section
            key={feature.key}
            className={`py-20 sm:py-28 ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div
                className={`flex flex-col items-center gap-12 lg:gap-16 ${
                  isReversed ? "lg:flex-row-reverse" : "lg:flex-row"
                }`}
              >
                {/* Screenshot */}
                <div className="w-full lg:w-1/2">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl">
                    {/* TODO: Replace with real app screenshot */}
                    <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-slate-200 to-slate-300">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Icon className="mx-auto h-16 w-16 text-slate-400" />
                          <p className="mt-3 text-sm font-medium text-slate-400">
                            {t(`detailed.${feature.key}.title`)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Screenshot placeholder
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="w-full lg:w-1/2">
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color} text-white`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    {t(`detailed.${feature.key}.title`)}
                  </h3>
                  <p className="mt-4 text-lg leading-relaxed text-slate-600">
                    {t(`detailed.${feature.key}.description`)}
                  </p>
                  <ul className="mt-8 space-y-4">
                    {feature.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        <div>
                          <span className="font-semibold text-slate-900">
                            {t(`detailed.${feature.key}.${highlight}`)}
                          </span>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {t(`detailed.${feature.key}.${highlight}Desc`)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Social Proof / Stats Section */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t("socialProofTitle")}
            </h2>
          </div>
          {/* Replace with real data and testimonials post-launch */}
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {stats.map(({ key, value, icon: Icon }) => (
              <div key={key} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#002045]/10">
                  <Icon className="h-7 w-7 text-[#002045]" />
                </div>
                <p className="mt-4 text-4xl font-extrabold text-[#002045]">
                  {value}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  {t(key)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-[#002045] py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-10">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-[#002045] shadow-lg transition hover:bg-slate-100"
            >
              {t("startFreeTrial")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-500">{t("footerCopyright")}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-sm text-slate-500 transition hover:text-slate-700">
              {t("footerPricing")}
            </Link>
            <Link href="/login" className="text-sm text-slate-500 transition hover:text-slate-700">
              {t("footerLogin")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
