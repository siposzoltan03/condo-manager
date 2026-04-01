import { setRequestLocale } from "next-intl/server";
import { hasMinimumRole } from "@/lib/rbac";
import {
  getDashboardContext,
  getAdminDashboard,
  getResidentDashboard,
} from "@/lib/dal";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ResidentDashboard } from "@/components/dashboard/resident-dashboard";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  const isBoardPlus = hasMinimumRole(ctx.role, "BOARD_MEMBER");

  if (isBoardPlus) {
    const data = await getAdminDashboard();
    return <AdminDashboard initialData={data} userName={ctx.userName} />;
  }

  const data = await getResidentDashboard();
  return <ResidentDashboard initialData={data} userName={ctx.userName} />;
}
