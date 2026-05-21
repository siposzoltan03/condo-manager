"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/format-time";
import { NotificationTypeIcon } from "@/components/notifications/notification-type-icon";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
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

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // polling — silent
    }
  }, []);

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
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the unread badge every 30 s.
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Lazy-load the panel contents.
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click.
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
      // poll will reconcile
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
      // silent
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg-3 hover:text-ink sm:h-9 sm:w-9"
        aria-label={tN("title")}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[10.5px] text-bg sm:-right-0.5 sm:-top-0.5"
            style={{ background: "var(--color-danger)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed right-4 top-16 mt-1 w-80 sm:w-96 rounded-xl border border-ink/10 bg-card z-[60] flex flex-col overflow-hidden"
          style={{
            boxShadow:
              "0 24px 48px -16px color-mix(in srgb, var(--color-ink) 25%, transparent), 0 8px 16px -8px color-mix(in srgb, var(--color-ink) 15%, transparent)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-ink">
              {tN("title")}
            </h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink transition-colors"
                >
                  {tN("markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-3 hover:text-ink sm:h-7 sm:w-7"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-ink/5">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                {t("loading")}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted">
                {tN("noNotifications")}
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) markAsRead(notification.id);
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg-3 transition-colors"
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
                    <NotificationTypeIcon type={notification.type} size="sm" withHalo />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug truncate ${
                        notification.isRead ? "text-ink-soft" : "text-ink"
                      }`}
                      style={{ fontWeight: notification.isRead ? 400 : 500 }}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="mt-1 font-mono text-[10.5px] text-muted">
                      {formatTimeAgo(notification.createdAt, locale)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--color-blue)" }}
                    />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ink/8 px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink transition-colors"
            >
              {tN("viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
