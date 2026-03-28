"use client";

import { useAuth } from "@/hooks/use-auth";
import { ResidentDashboard } from "./resident-dashboard";
import { AdminDashboard } from "./admin-dashboard";

export function DashboardSwitch() {
  const { hasRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (hasRole("BOARD_MEMBER")) {
    return <AdminDashboard />;
  }

  return <ResidentDashboard />;
}
