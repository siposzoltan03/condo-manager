"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface Props {
  recipientCount: number;
}

export function EmergencyButton({ recipientCount }: Props) {
  const t = useTranslations("communication.emergency");
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    if (submitting) return;
    if (!title.trim() || !body.trim()) return;
    const ok = await confirm({
      title: t("confirm", { n: recipientCount.toString() }),
      danger: true,
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/communication/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "send failed");
      }
      const json = (await res.json()) as { channelId: string };
      toast.success(t("sent"));
      setOpen(false);
      setTitle("");
      setBody("");
      router.push(`/communication?channel=${json.channelId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "send failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="transition-opacity hover:opacity-90"
        style={{
          padding: "9px 16px",
          fontSize: "12.5px",
          fontWeight: 600,
          borderRadius: "8px",
          background: "#c44",
          color: "#fff",
          border: "1px solid #b33",
          cursor: "pointer",
          letterSpacing: "0.01em",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span aria-hidden>⚠</span>
        {t("cta")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          style={{
            background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
          }}
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 92vw)",
              background: "var(--color-card)",
              borderRadius: "16px",
              padding: "24px 26px",
              border: "1px solid #c44",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "#c44",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              ⚠ {t("cta")}
            </div>
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.022em",
                marginBottom: "4px",
              }}
            >
              {t("modalTitle")}
            </h2>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--color-ink-soft)",
                marginBottom: "16px",
              }}
            >
              {t("modalSubtitle")}
            </p>

            <label
              className="font-mono block"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              {t("title")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePh")}
              style={{
                width: "100%",
                background: "var(--color-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "14px",
                fontWeight: 600,
                outline: "none",
                marginBottom: "12px",
              }}
            />

            <label
              className="font-mono block"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              {t("body")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("bodyPh")}
              rows={4}
              style={{
                width: "100%",
                background: "var(--color-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13.5px",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: "20px",
              }}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                style={{
                  padding: "9px 14px",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--color-ink)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
                  cursor: "pointer",
                }}
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={send}
                disabled={submitting || !title.trim() || !body.trim()}
                className="transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{
                  padding: "9px 18px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  background: "#c44",
                  color: "#fff",
                  border: "1px solid #b33",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? t("sending") : t("send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
