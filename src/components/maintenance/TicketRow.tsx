"use client";

import { useTranslations } from "next-intl";
import {
  ChevronRight,
  AlertTriangle,
  AlertOctagon,
  Droplets,
  Zap,
  Building2,
  Users,
  ArrowUpDown,
  Flame,
  HelpCircle,
} from "lucide-react";

interface TicketRowProps {
  ticket: {
    id: string;
    trackingNumber: string;
    title: string;
    category: string;
    urgency: string;
    status: string;
    reporter: { id: string; name: string };
    assignedContractor: { id: string; name: string } | null;
    createdAt: string;
  };
  onClick: (id: string) => void;
}

const URGENCY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-l-4 border-red-500",
  HIGH: "bg-orange-50 text-orange-800 border-l-4 border-orange-400",
  MEDIUM: "bg-blue-50 text-blue-800 border-l-4 border-blue-300",
  LOW: "bg-slate-50 text-slate-600",
};

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  ACKNOWLEDGED: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  VERIFIED: "bg-emerald-100 text-emerald-800",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PLUMBING: Droplets,
  ELECTRICAL: Zap,
  STRUCTURAL: Building2,
  COMMON_AREA: Users,
  ELEVATOR: ArrowUpDown,
  HEATING: Flame,
  OTHER: HelpCircle,
};

export function TicketRow({ ticket, onClick }: TicketRowProps) {
  const t = useTranslations("maintenance");

  const urgencyStyle = URGENCY_STYLES[ticket.urgency] ?? URGENCY_STYLES.LOW;
  const statusStyle = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.SUBMITTED;
  const CategoryIcon = CATEGORY_ICONS[ticket.category] ?? HelpCircle;
  const UrgencyIcon = ticket.urgency === "CRITICAL" ? AlertOctagon : ticket.urgency === "HIGH" ? AlertTriangle : null;

  return (
    <div
      onClick={() => onClick(ticket.id)}
      className={`cursor-pointer rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-xl ${urgencyStyle}`}
    >
      <div className="grid grid-cols-12 items-center gap-3">
        {/* Tracking + Title + Category (col-span-4) */}
        <div className="col-span-12 sm:col-span-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            {UrgencyIcon && <UrgencyIcon className="h-4 w-4 shrink-0" />}
            <CategoryIcon className="h-4 w-4 shrink-0 text-slate-500" />
          </div>
          <div className="min-w-0">
            <span className="block font-mono text-xs text-slate-500">
              {ticket.trackingNumber}
            </span>
            <span className="block truncate text-sm font-medium text-slate-900">
              {ticket.title}
            </span>
          </div>
        </div>

        {/* Reporter (col-span-3) */}
        <div className="col-span-6 sm:col-span-3">
          <span className="text-xs text-slate-500">{t("reporter")}</span>
          <span className="block truncate text-sm text-slate-700">
            {ticket.reporter.name}
          </span>
        </div>

        {/* Contractor (col-span-3) */}
        <div className="col-span-6 sm:col-span-3">
          <span className="text-xs text-slate-500">{t("contractor")}</span>
          <span className="block truncate text-sm text-slate-700">
            {ticket.assignedContractor?.name ?? t("unassigned")}
          </span>
        </div>

        {/* Status + Date (col-span-2) */}
        <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:flex-col sm:items-end sm:justify-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
          >
            {t(`status_${ticket.status}`)}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
          <ChevronRight className="hidden sm:block h-4 w-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
