"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { useBuilding } from "@/hooks/use-building";
import {
  Megaphone,
  CreditCard,
  Wrench,
  Vote,
  Bell,
  ArrowRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface AnnouncementPreview {
  id: string;
  title: string;
  createdAt: string;
}

interface PaymentSummary {
  currentMonthStatus: "PAID" | "UNPAID" | "OVERDUE" | null;
  nextDueDate: string | null;
  nextAmount: number | null;
}

interface MaintenanceTicketPreview {
  id: string;
  title: string;
  status: string;
  urgency: string;
  createdAt: string;
}

interface VotePreview {
  id: string;
  title: string;
  deadline: string;
  voteType: string;
}

export function ResidentDashboard() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { activeBuildingId, buildings } = useBuilding();
  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);

  const [announcements, setAnnouncements] = useState<AnnouncementPreview[]>([]);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [tickets, setTickets] = useState<MaintenanceTicketPreview[]>([]);
  const [votes, setVotes] = useState<VotePreview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const [announcementsRes, chargesRes, ticketsRes, votesRes, notifsRes] =
          await Promise.allSettled([
            fetch("/api/announcements?limit=3"),
            fetch("/api/finance/charges?limit=1"),
            fetch(
              "/api/maintenance/tickets?status=SUBMITTED,ACKNOWLEDGED,ASSIGNED,IN_PROGRESS&limit=5"
            ),
            fetch("/api/voting/votes?status=OPEN&limit=5"),
            fetch("/api/notifications?limit=1"),
          ]);

        // Announcements
        if (
          announcementsRes.status === "fulfilled" &&
          announcementsRes.value.ok
        ) {
          const data = await announcementsRes.value.json();
          setAnnouncements(
            (data.announcements || []).slice(0, 3).map((a: Record<string, unknown>) => ({
              id: a.id,
              title: a.title,
              createdAt: a.createdAt,
            }))
          );
        }

        // Payment status
        if (chargesRes.status === "fulfilled" && chargesRes.value.ok) {
          const data = await chargesRes.value.json();
          const charges = data.charges || [];
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const currentCharge = charges.find(
            (c: Record<string, unknown>) => c.month === currentMonth
          );
          const unpaidCharges = charges.filter(
            (c: Record<string, unknown>) => c.status === "UNPAID" || c.status === "OVERDUE"
          );
          const nextUnpaid = unpaidCharges[0];
          setPayment({
            currentMonthStatus: currentCharge?.status ?? null,
            nextDueDate: nextUnpaid?.dueDate ?? null,
            nextAmount: nextUnpaid?.amount
              ? parseFloat(nextUnpaid.amount as string)
              : null,
          });
        }

        // Open maintenance tickets (own)
        if (ticketsRes.status === "fulfilled" && ticketsRes.value.ok) {
          const data = await ticketsRes.value.json();
          setTickets(
            (data.tickets || []).slice(0, 5).map((t: Record<string, unknown>) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              urgency: t.urgency,
              createdAt: t.createdAt,
            }))
          );
        }

        // Open votes
        if (votesRes.status === "fulfilled" && votesRes.value.ok) {
          const data = await votesRes.value.json();
          setVotes(
            (data.votes || []).slice(0, 5).map((v: Record<string, unknown>) => ({
              id: v.id,
              title: v.title,
              deadline: v.deadline,
              voteType: v.voteType,
            }))
          );
        }

        // Unread notifications
        if (notifsRes.status === "fulfilled" && notifsRes.value.ok) {
          const data = await notifsRes.value.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        // Dashboard is best-effort, individual cards handle their own empty state
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {t("welcomeBack", { name: user?.name || "" })}
        </h1>
        {activeBuilding && (
          <p className="text-sm font-medium text-blue-600">{activeBuilding.name}</p>
        )}
        <p className="text-slate-500">{t("overview")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Recent Announcements */}
        <DashboardCard
          icon={<Megaphone className="h-5 w-5 text-blue-600" />}
          title={t("recentAnnouncements")}
          linkHref="/announcements"
          linkLabel={t("viewAll")}
        >
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noRecentAnnouncements")}</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/announcements/${a.id}`}
                    className="group block"
                  >
                    <p className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                      {a.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* My Payment Status */}
        <DashboardCard
          icon={<CreditCard className="h-5 w-5 text-green-600" />}
          title={t("myPaymentStatus")}
          linkHref="/finance"
          linkLabel={t("viewDetails")}
        >
          {payment === null ? (
            <p className="text-sm text-slate-400">{t("noPaymentData")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {payment.currentMonthStatus === "PAID" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      {t("currentMonthPaid")}
                    </span>
                  </>
                ) : payment.currentMonthStatus === "OVERDUE" ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      {t("currentMonthOverdue")}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">
                      {t("currentMonthUnpaid")}
                    </span>
                  </>
                )}
              </div>
              {payment.nextDueDate && (
                <div className="text-sm text-slate-600">
                  <span className="text-slate-400">{t("nextDue")}:</span>{" "}
                  {new Date(payment.nextDueDate).toLocaleDateString()}
                  {payment.nextAmount !== null && (
                    <span className="ml-2 font-semibold">
                      {payment.nextAmount.toLocaleString()} Ft
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </DashboardCard>

        {/* My Open Maintenance Tickets */}
        <DashboardCard
          icon={<Wrench className="h-5 w-5 text-orange-600" />}
          title={t("myOpenTickets")}
          linkHref="/maintenance"
          linkLabel={t("viewAll")}
        >
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noOpenTickets")}</p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/maintenance/${ticket.id}`}
                    className="group flex items-center justify-between"
                  >
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                      {ticket.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ticket.urgency === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : ticket.urgency === "HIGH"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Upcoming Votes */}
        <DashboardCard
          icon={<Vote className="h-5 w-5 text-purple-600" />}
          title={t("upcomingVotes")}
          linkHref="/voting"
          linkLabel={t("viewAll")}
        >
          {votes.length === 0 ? (
            <p className="text-sm text-slate-400">{t("noActiveVotes")}</p>
          ) : (
            <ul className="space-y-2">
              {votes.map((vote) => (
                <li key={vote.id}>
                  <Link
                    href="/voting"
                    className="group block"
                  >
                    <p className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                      {vote.title}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(vote.deadline).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* Unread Messages */}
        <DashboardCard
          icon={<Bell className="h-5 w-5 text-sky-600" />}
          title={t("notifications")}
          linkHref="/messages"
          linkLabel={t("viewMessages")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
              <span className="text-xl font-bold text-sky-600">
                {unreadCount}
              </span>
            </div>
            <span className="text-sm text-slate-600">
              {t("unreadNotifications", { count: unreadCount })}
            </span>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared card wrapper                                                 */
/* ------------------------------------------------------------------ */

function DashboardCard({
  icon,
  title,
  linkHref,
  linkLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  linkHref: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        <Link
          href={linkHref}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {linkLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}
