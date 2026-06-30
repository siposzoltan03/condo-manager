"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useBuilding } from "@/hooks/use-building";
import type { AdminDashboardData } from "@/lib/dal";
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

interface AdminSummary {
  totalUnits: number;
  totalResidents: number;
  currentFundBalance: number;
  reserveFundBalance: number;
  overduePaymentsCount: number;
  openComplaintsCount: number;
  pendingMaintenanceCount: number;
}

interface AdminDashboardProps {
  initialData: AdminDashboardData;
  userName: string;
}

export function AdminDashboard({ initialData, userName }: AdminDashboardProps) {
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const { activeBuildingId, buildings } = useBuilding();
  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);

  const [summary] = useState<AdminSummary | null>({
    ...initialData,
    // Finance data still fetched client-side
    currentFundBalance: 0,
    reserveFundBalance: 0,
  });
  const [loading] = useState(false);

  // Fetch finance data client-side (complex ledger aggregation)
  const [financeLoaded, setFinanceLoaded] = useState(false);
  const [currentFundBalance, setCurrentFundBalance] = useState(0);
  const [reserveFundBalance, setReserveFundBalance] = useState(0);

  useEffect(() => {
    async function fetchFinance() {
      try {
        const res = await fetch("/api/finance/summary");
        if (res.ok) {
          const data = await res.json();
          setCurrentFundBalance(data.currentFundBalance ?? 0);
          setReserveFundBalance(data.reserveFundBalance ?? 0);
        }
      } catch {
        // best-effort
      } finally {
        setFinanceLoaded(true);
      }
    }
    fetchFinance();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("welcomeBack", { name: userName || user?.name || "" })}
        </h1>
        {activeBuilding && (
          <p className="text-sm font-medium text-blue-600">{activeBuilding.name}</p>
        )}
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
              value={`${currentFundBalance.toLocaleString()} Ft`}
              sublabel={t("reserveFund", {
                amount: reserveFundBalance.toLocaleString(),
              })}
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
              label={t("overduePayments")}
              value={`${summary.overduePaymentsCount}`}
              sublabel={t("overdueCount", {
                count: summary.overduePaymentsCount,
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
                href="/communication"
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

      {/* Resident-level data omitted in admin view */}
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
