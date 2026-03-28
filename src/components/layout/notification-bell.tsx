"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bell,
  Megaphone,
  Mail,
  Wrench,
  Wallet,
  Vote,
  AlertTriangle,
  X,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/format-time";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

function NotificationIcon({ type }: { type: string }) {
  const iconClass = "h-4 w-4 shrink-0";
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

export function NotificationBell() {
  const t = useTranslations("common");
  const tN = useTranslations("notifications");
  const locale = useLocale();

  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch unread badge count (lightweight, runs on a 30s interval)
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // silently ignore polling errors
    }
  }, []);

  // Fetch the full notification list for the dropdown
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling for badge count
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Load notifications when the panel opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistically update UI
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
        // silently ignore; the next poll will reconcile
      }
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistically update UI
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

  return (
    <div ref={containerRef} className="relative">
      {/* Bell trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label={tN("title")}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fixed right-4 top-16 mt-1 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-[60] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {tN("title")}
            </h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {tN("markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                {t("loading")}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                {tN("noNotifications")}
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsRead(notification.id);
                    }
                  }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                    !notification.isRead ? "bg-blue-50/40" : ""
                  }`}
                >
                  {/* Type icon */}
                  <div className="mt-0.5">
                    <NotificationIcon type={notification.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug truncate ${
                        notification.isRead
                          ? "font-normal text-slate-700"
                          : "font-semibold text-slate-900"
                      }`}
                    >
                      {notification.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatTimeAgo(notification.createdAt, locale)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notification.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              {tN("viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
