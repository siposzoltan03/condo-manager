"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import {
  Building2,
  Users,
  Wallet,
  AlertTriangle,
  Wrench,
  Megaphone,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { ResidentDashboard } from "./resident-dashboard";

interface AdminSummary {
  totalUnits: number;
  totalResidents: number;
  currentFundBalance: number;
  reserveFundBalance: number;
  overduePaymentsCount: number;
  openComplaintsCount: number;
  pendingMaintenanceCount: number;
}

export function AdminDashboard() {
  const t = useTranslations("dashboard");
  const { user } = useAuth();

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      try {
        const [usersRes, financeRes, chargesRes, complaintsRes, maintenanceRes] =
          await Promise.allSettled([
            fetch("/api/users?limit=1"),
            fetch("/api/finance/summary"),
            fetch("/api/finance/charges?limit=1"),
            fetch("/api/complaints?status=SUBMITTED,UNDER_REVIEW,IN_PROGRESS&limit=1"),
            fetch(
              "/api/maintenance/tickets?status=SUBMITTED,ACKNOWLEDGED&limit=1"
            ),
          ]);

        let totalResidents = 0;
        let totalUnits = 0;
        if (usersRes.status === "fulfilled" && usersRes.value.ok) {
          const data = await usersRes.value.json();
          totalResidents = data.total ?? 0;
          totalUnits = data.totalUnits ?? totalResidents;
        }

        let currentFundBalance = 0;
        let reserveFundBalance = 0;
        if (financeRes.status === "fulfilled" && financeRes.value.ok) {
          const data = await financeRes.value.json();
          currentFundBalance = data.currentFundBalance ?? 0;
          reserveFundBalance = data.reserveFundBalance ?? 0;
        }

        let overduePaymentsCount = 0;
        if (chargesRes.status === "fulfilled" && chargesRes.value.ok) {
          const data = await chargesRes.value.json();
          overduePaymentsCount = data.overdueCount ?? 0;
        }

        let openComplaintsCount = 0;
        if (complaintsRes.status === "fulfilled" && complaintsRes.value.ok) {
          const data = await complaintsRes.value.json();
          openComplaintsCount = data.total ?? 0;
        }

        let pendingMaintenanceCount = 0;
        if (maintenanceRes.status === "fulfilled" && maintenanceRes.value.ok) {
          const data = await maintenanceRes.value.json();
          pendingMaintenanceCount = data.total ?? 0;
        }

        setSummary({
          totalUnits,
          totalResidents,
          currentFundBalance,
          reserveFundBalance,
          overduePaymentsCount,
          openComplaintsCount,
          pendingMaintenanceCount,
        });
      } catch {
        // best-effort
      } finally {
        setLoading(false);
      }
    }

    fetchAdminData();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("welcomeBack", { name: user?.name || "" })}
        </h1>
        <p className="text-slate-500">{t("adminOverview")}</p>
      </div>

      {/* Admin-only summary cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        </div>
      ) : summary ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Building2 className="h-5 w-5 text-blue-600" />}
              label={t("buildingOverview")}
              value={`${summary.totalUnits}`}
              sublabel={t("totalResidents", { count: summary.totalResidents })}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5 text-green-600" />}
              label={t("financialSummary")}
              value={`${summary.currentFundBalance.toLocaleString()} Ft`}
              sublabel={t("reserveFund", {
                amount: summary.reserveFundBalance.toLocaleString(),
              })}
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
              label={t("overduePayments")}
              value={`${summary.overduePaymentsCount}`}
              sublabel={t("openComplaints", {
                count: summary.openComplaintsCount,
              })}
              alert={summary.overduePaymentsCount > 0}
            />
            <StatCard
              icon={<Wrench className="h-5 w-5 text-orange-600" />}
              label={t("pendingMaintenance")}
              value={`${summary.pendingMaintenanceCount}`}
              sublabel={t("awaitingAction")}
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              {t("quickActions")}
            </h2>
            <div className="flex flex-wrap gap-3">
              <QuickAction
                icon={<Megaphone className="h-4 w-4" />}
                label={t("createAnnouncement")}
                href="/announcements"
              />
              <QuickAction
                icon={<CreditCard className="h-4 w-4" />}
                label={t("recordPayment")}
                href="/finance"
              />
              <QuickAction
                icon={<Wrench className="h-4 w-4" />}
                label={t("newMaintenanceTicket")}
                href="/maintenance"
              />
            </div>
          </div>
        </>
      ) : null}

      {/* Also show resident-level dashboard data */}
      <ResidentDashboard />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        alert ? "border-red-200" : "border-slate-200"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{sublabel}</p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-600"
    >
      <PlusCircle className="h-4 w-4" />
      {icon}
      {label}
    </Link>
  );
}
