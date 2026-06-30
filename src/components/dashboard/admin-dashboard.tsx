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
        <h1 className="text-2xl font-bold text-ink">
          {t("welcomeBack", { name: userName || user?.name || "" })}
        </h1>
        {activeBuilding && (
          <p className="text-sm font-medium text-blue">{activeBuilding.name}</p>
        )}
        <p className="text-muted">{t("adminOverview")}</p>
      </div>

      {/* Admin-only summary cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-bg-2 border-t-blue" />
        </div>
      ) : summary ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Building2 className="h-5 w-5 text-blue" />}
              label={t("buildingOverview")}
              value={`${summary.totalUnits}`}
              sublabel={t("totalResidents", { count: summary.totalResidents })}
            />
            <StatCard
              icon={<Wallet className="h-5 w-5 text-good" />}
              label={t("financialSummary")}
              value={`${currentFundBalance.toLocaleString()} Ft`}
              sublabel={t("reserveFund", {
                amount: reserveFundBalance.toLocaleString(),
              })}
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-danger" />}
              label={t("overduePayments")}
              value={`${summary.overduePaymentsCount}`}
              sublabel={t("overdueCount", {
                count: summary.overduePaymentsCount,
              })}
              alert={summary.overduePaymentsCount > 0}
            />
            <StatCard
              icon={<Wrench className="h-5 w-5 text-ochre" />}
              label={t("pendingMaintenance")}
              value={`${summary.pendingMaintenanceCount}`}
              sublabel={t("awaitingAction")}
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-ink-soft">
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
      className={`rounded-xl border bg-card p-4 shadow-sm ${
        alert ? "border-danger/40" : "border-tile-a"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{sublabel}</p>
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
      className="inline-flex items-center gap-2 rounded-lg border border-tile-a bg-card px-4 py-2 text-sm font-medium text-ink-soft shadow-sm transition-colors hover:border-blue/40 hover:text-blue"
    >
      <PlusCircle className="h-4 w-4" />
      {icon}
      {label}
    </Link>
  );
}
