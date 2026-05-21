"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { PendingResignationItem } from "@/lib/voting-dal";

interface Props {
  items: PendingResignationItem[];
}

export function PendingResignationsCard({ items }: Props) {
  const t = useTranslations("voting.meetings.resignations");
  const router = useRouter();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function acknowledge(id: string) {
    const ok = await confirm({ title: t("ackConfirm") });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/board-resignations/${id}/acknowledge`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("ackError"));
      }
      toast.success(t("ackDone"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ackError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ochre) 40%, transparent)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginBottom: "24px",
      }}
    >
      <div className="flex items-center gap-2.5" style={{ marginBottom: "12px" }}>
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background:
              "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
            color:
              "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </span>
        <h3
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "-0.015em",
          }}
        >
          {t("title", { n: items.length.toString() })}
        </h3>
      </div>
      <p
        style={{
          fontSize: "12.5px",
          color: "var(--color-ink-soft)",
          marginBottom: "14px",
          lineHeight: 1.5,
        }}
      >
        {t("desc")}
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: "10px",
        }}
      >
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3"
            style={{
              padding: "12px 14px",
              background: "var(--color-bg-3)",
              borderRadius: "10px",
            }}
          >
            <span
              className="grid place-items-center flex-shrink-0"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "var(--color-ochre)",
                color: "var(--color-ink)",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              {r.residentInitials}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: "13.5px", fontWeight: 600 }}>
                {r.residentName}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                  marginTop: "2px",
                }}
              >
                {r.meetingDateISO
                  ? t("scheduled", {
                      date: new Date(r.meetingDateISO).toLocaleDateString(
                        "hu-HU",
                        { month: "short", day: "numeric" },
                      ),
                    })
                  : t("noMeeting")}
                {r.reason && (
                  <>
                    {" · "}
                    <span style={{ fontStyle: "italic" }}>{r.reason}</span>
                  </>
                )}
              </div>
            </div>
            {r.isOwn ? (
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                  fontStyle: "italic",
                }}
              >
                {t("ownBadge")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => acknowledge(r.id)}
                disabled={busyId === r.id}
                className="transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  padding: "7px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  border: "1px solid var(--color-ink)",
                  cursor: busyId === r.id ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {busyId === r.id ? t("acking") : t("ackCta")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
