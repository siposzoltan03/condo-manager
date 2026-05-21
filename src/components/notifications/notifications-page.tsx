"use client";

import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { formatTimeAgo } from "@/lib/format-time";
import { NotificationTypeIcon } from "./notification-type-icon";

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

interface NotificationsPageProps {
  initialData: {
    notifications: Notification[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export function NotificationsPage({ initialData }: NotificationsPageProps) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [notifications, setNotifications] = useState<Notification[]>(
    initialData.notifications,
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialData.page);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [unreadCount, setUnreadCount] = useState(
    initialData.notifications.filter((n) => !n.isRead).length,
  );

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
          `/api/notifications?page=${pageNum}&limit=${LIMIT}`,
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
    [tCommon],
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    } catch {
      // optimistic — next poll will reconcile
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
      // optimistic
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            {t("title")}
          </span>
          <h1 className="mt-1 font-display text-3xl text-ink leading-tight">
            {unreadCount > 0
              ? `${t("title")} · ${unreadCount} ${t("unreadShort")}`
              : t("title")}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-card px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-bg-3 transition-colors"
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted">{tCommon("loading")}</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-ink/8 bg-card px-6 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-3">
            <Bell className="h-6 w-6 text-muted" />
          </div>
          <p className="text-sm text-muted">{t("noNotifications")}</p>
        </div>
      ) : (
        /* Notification list */
        <div className="overflow-hidden rounded-xl border border-ink/8 bg-card divide-y divide-ink/5">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => {
                if (!notification.isRead) markAsRead(notification.id);
              }}
              className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-bg-3 transition-colors"
              style={
                !notification.isRead
                  ? {
                      background:
                        "color-mix(in srgb, var(--color-blue) 6%, transparent)",
                    }
                  : undefined
              }
            >
              <div className="mt-0.5">
                <NotificationTypeIcon type={notification.type} withHalo />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-snug ${
                    notification.isRead ? "text-ink-soft" : "text-ink"
                  }`}
                  style={{
                    fontWeight: notification.isRead ? 400 : 500,
                  }}
                >
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-ink-soft leading-relaxed">
                  {notification.body}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-muted">
                  {formatTimeAgo(notification.createdAt, locale)}
                </p>
              </div>

              {!notification.isRead && (
                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: "var(--color-blue)" }}
                />
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
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-card px-6 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-bg-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingMore ? tCommon("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
