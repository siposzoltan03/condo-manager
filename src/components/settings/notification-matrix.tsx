"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateNotificationMatrix } from "@/app/actions/profile";
import type {
  NotificationMatrix,
  NotificationEventKey,
  NotificationChannel,
} from "@/lib/profile-dal";

interface Props {
  initial: NotificationMatrix;
  initialQuietHoursStart: string | null;
  initialQuietHoursEnd: string | null;
}

const EVENT_KEYS: NotificationEventKey[] = [
  "announcements",
  "voting",
  "finance",
  "maintenance",
  "comments",
  "marketing",
];
const CHANNELS: NotificationChannel[] = ["push", "email", "sms", "digest"];

export function NotificationMatrixView({
  initial,
  initialQuietHoursStart,
  initialQuietHoursEnd,
}: Props) {
  const t = useTranslations("profile.notifications");
  const router = useRouter();

  const [matrix, setMatrix] = useState<NotificationMatrix>(initial);
  const [quietStart, setQuietStart] = useState(initialQuietHoursStart ?? "");
  const [quietEnd, setQuietEnd] = useState(initialQuietHoursEnd ?? "");
  const [saving, setSaving] = useState(false);

  function toggle(ev: NotificationEventKey, ch: NotificationChannel) {
    setMatrix((prev) => ({
      ...prev,
      [ev]: { ...prev[ev], [ch]: !prev[ev][ch] },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await updateNotificationMatrix(matrix, {
        start: quietStart || null,
        end: quietEnd || null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Quiet hours */}
      <div
        className="grid grid-cols-2 gap-4 sm:gap-5"
        style={{ marginBottom: "22px" }}
      >
        <Field label={t("quietHoursStart")}>
          <input
            type="time"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label={t("quietHoursEnd")}>
          <input
            type="time"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Matrix — horizontal scroll on phone where the 5-col layout
          exceeds viewport width. Phase D+ candidate for a card-list
          per-event view; for now scroll is the safe fallback. */}
      <div
        style={{
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          borderRadius: "10px",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <div
          className="grid font-mono"
          style={{
            gridTemplateColumns: "minmax(180px, 1fr) 80px 80px 80px 80px",
            gap: 0,
            background: "var(--color-bg-3)",
            padding: "10px 14px",
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          <span>{t("colEvent")}</span>
          <span style={{ textAlign: "center" }}>{t("channel.push")}</span>
          <span style={{ textAlign: "center" }}>{t("channel.email")}</span>
          <span style={{ textAlign: "center" }}>{t("channel.sms")}</span>
          <span style={{ textAlign: "center" }}>{t("channel.digest")}</span>
        </div>
        {EVENT_KEYS.map((ev) => (
          <div
            key={ev}
            className="grid items-center"
            style={{
              gridTemplateColumns: "minmax(180px, 1fr) 80px 80px 80px 80px",
              gap: 0,
              padding: "12px 14px",
              borderTop:
                "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 500 }}>
                {t(`event.${ev}.label`)}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                  marginTop: "2px",
                  textTransform: "uppercase",
                  fontWeight: 400,
                }}
              >
                {t(`event.${ev}.sub`)}
              </div>
            </div>
            {CHANNELS.map((ch) => (
              <div key={ch} style={{ textAlign: "center" }}>
                <Toggle on={matrix[ev][ch]} onClick={() => toggle(ev, ch)} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div
        className="flex justify-end"
        style={{ marginTop: "16px" }}
      >
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            border: "1px solid var(--color-ink)",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? t("saving") : t("saveCta")}
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: "inline-block",
        width: "32px",
        height: "18px",
        borderRadius: "9px",
        background: on
          ? "var(--color-ink)"
          : "color-mix(in srgb, var(--color-ink) 15%, transparent)",
        margin: "0 auto",
        position: "relative",
        cursor: "pointer",
        border: 0,
        transition: "background 120ms",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "2px",
          left: on ? "16px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 120ms",
        }}
      />
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-bg-3)",
  border: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
  borderRadius: "7px",
  padding: "9px 12px",
  fontSize: "14px",
  color: "var(--color-ink)",
  fontWeight: 500,
  outline: "none",
};
