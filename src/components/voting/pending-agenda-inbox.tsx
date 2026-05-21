"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { PendingAgendaInboxItem } from "@/lib/voting-dal";

interface Props {
  locale: string;
  items: PendingAgendaInboxItem[];
  nextMeeting: { id: string; title: string; date: string } | null;
}

export function PendingAgendaInbox({ locale, items, nextMeeting }: Props) {
  const t = useTranslations("voting.pendingInbox");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function attach(itemIds: string[]) {
    if (!nextMeeting) return;
    if (itemIds.length === 0) return;
    setBusy(itemIds.length > 1);
    if (itemIds.length === 1) setBusyId(itemIds[0]);
    try {
      const res = await fetch("/api/pending-agenda-items/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: nextMeeting.id, itemIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "attach failed");
      }
      toast.success(t("attachedToast", { n: itemIds.length.toString() }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "attach failed");
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ochre) 35%, transparent)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginBottom: "24px",
      }}
    >
      <div
        className="flex items-baseline justify-between gap-4"
        style={{ marginBottom: "12px" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden style={{ fontSize: "16px" }}>
              📋
            </span>
            <h3
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                letterSpacing: "-0.015em",
              }}
            >
              {t("title")}
            </h3>
          </div>
          <p
            className="font-mono"
            style={{
              fontSize: "10.5px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginTop: "4px",
            }}
          >
            {t("subtitle", { n: items.length.toString() })}
          </p>
        </div>
        {nextMeeting && items.length > 1 && (
          <button
            type="button"
            onClick={() => attach(items.map((i) => i.id))}
            disabled={busy}
            className="transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: 0,
              cursor: busy ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {busy ? t("attaching") : t("attachAll")}
          </button>
        )}
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: "8px",
        }}
      >
        {items.map((i) => (
          <li
            key={i.id}
            className="flex items-start gap-3"
            style={{
              padding: "10px 12px",
              background: "var(--color-bg-3)",
              borderRadius: "10px",
            }}
          >
            <span
              aria-hidden
              style={{ fontSize: "14px", lineHeight: 1, marginTop: "2px" }}
            >
              {i.kind === "COMPLAINT_ESCALATION" ? "⚠️" : "👋"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {i.title}
                </span>
                {i.complaintTrackingNumber && (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {i.complaintTrackingNumber}
                  </span>
                )}
              </div>
              {i.description && (
                <div
                  style={{
                    fontSize: "11.5px",
                    color: "var(--color-ink-soft)",
                    marginTop: "2px",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {i.description}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                href={`/${locale}${i.sourceHref}`}
                className="font-mono"
                style={{
                  fontSize: "10px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "var(--color-card)",
                  color: "var(--color-ink-soft)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  textDecoration: "none",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {t("openSource")}
              </Link>
              {nextMeeting && (
                <button
                  type="button"
                  onClick={() => attach([i.id])}
                  disabled={busyId === i.id}
                  className="font-mono transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{
                    fontSize: "10px",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    background: "var(--color-ink)",
                    color: "var(--color-bg)",
                    border: 0,
                    cursor: busyId === i.id ? "not-allowed" : "pointer",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                  title={t("attachToNext", { meeting: nextMeeting.title })}
                >
                  {busyId === i.id
                    ? t("attaching")
                    : t("attachToNext", { meeting: nextMeeting.title })}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!nextMeeting && (
        <p
          className="font-mono"
          style={{
            marginTop: "10px",
            fontSize: "10.5px",
            color: "var(--color-muted)",
            letterSpacing: "0.05em",
            fontStyle: "italic",
          }}
        >
          {t("noNextMeeting")}
        </p>
      )}
    </div>
  );
}
