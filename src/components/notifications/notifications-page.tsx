"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Megaphone,
  Mail,
  Wrench,
  Wallet,
  Vote,
  AlertTriangle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { formatTimeAgo } from "@/lib/format-time";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}

export function NotificationIcon({
  type,
  size = "md",
}: {
  type: string;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0";
  switch (type) {
    case "ANNOUNCEMENT_NEW":
      return <Megaphone className={`${iconClass} text-blue-500`} />;
    case "MESSAGE_NEW":
      return <Mail className={`${iconClass} text-indigo-500`} />;
    case "MAINTENANCE_STATUS":
      return <Wrench className={`${iconClass} text-orange-500`} />;
    case "PAYMENT_REMINDER":
      return <Wallet className={`${iconClass} text-green-500`} />;
    case "VOTE_OPEN":
    case "VOTE_CLOSING":
      return <Vote className={`${iconClass} text-purple-500`} />;
    case "COMPLAINT_STATUS":
      return <AlertTriangle className={`${iconClass} text-red-500`} />;
    default:
      return <Bell className={`${iconClass} text-slate-400`} />;
  }
}

export function NotificationsPage() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const LIMIT = 50;

  const fetchNotifications = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const res = await fetch(
          `/api/notifications?page=${pageNum}&limit=${LIMIT}`
        );
        if (!res.ok) throw new Error("Failed to fetch notifications");

        const data: NotificationsResponse = await res.json();

        if (append) {
          setNotifications((prev) => [...prev, ...data.notifications]);
        } else {
          setNotifications(data.notifications);
        }

        setTotalPages(data.totalPages);
        setUnreadCount(data.unreadCount);
        setPage(pageNum);
      } catch {
        setError(tCommon("error"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tCommon]
  );

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    } catch {
      // silently ignore; state already updated optimistically
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // silently ignore
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages && !loadingMore) {
      fetchNotifications(page + 1, true);
    }
  }, [page, totalPages, loadingMore, fetchNotifications]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-manrope text-4xl font-extrabold text-[#002045]">
          {t("title")}
        </h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Bell className="h-7 w-7 text-slate-400" />
          </div>
          <p className="text-base font-medium text-slate-600">
            {t("noNotifications")}
          </p>
        </div>
      ) : (
        /* Notification list */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => {
                if (!notification.isRead) {
                  markAsRead(notification.id);
                }
              }}
              className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${
                !notification.isRead ? "bg-blue-50/40" : ""
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <NotificationIcon type={notification.type} size="sm" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-snug ${
                    notification.isRead
                      ? "font-normal text-slate-700"
                      : "font-semibold text-slate-900"
                  }`}
                >
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                  {notification.body}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  {formatTimeAgo(notification.createdAt, locale)}
                </p>
              </div>

              {/* Unread dot */}
              {!notification.isRead && (
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && page < totalPages && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingMore ? tCommon("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
