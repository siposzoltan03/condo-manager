"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { ProfileSession } from "@/lib/profile-dal";

interface Props {
  sessions: ProfileSession[];
}

export function SessionsTable({ sessions }: Props) {
  const t = useTranslations("profile.security.sessions");
  const router = useRouter();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function revoke(id: string) {
    const ok = await confirm({
      title: t("revokeConfirm"),
      danger: true,
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/profile/sessions/${id}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("revokeError"));
      }
      toast.success(t("revoked"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("revokeError"));
    } finally {
      setBusyId(null);
    }
  }

  if (sessions.length === 0) {
    return (
      <div
        className="font-mono"
        style={{
          padding: "16px 14px",
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          background: "var(--color-bg-3)",
          borderRadius: "8px",
          textTransform: "uppercase",
          marginTop: "16px",
        }}
      >
        {t("empty")}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "16px" }}>
      <h3
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
          marginBottom: "10px",
        }}
      >
        {t("title", { n: sessions.length.toString() })}
      </h3>
      <div
        style={{
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          borderRadius: "10px",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <Header />
        {sessions.map((s) => (
          <Row
            key={s.id}
            session={s}
            busy={busyId === s.id}
            onRevoke={() => revoke(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Header() {
  const t = useTranslations("profile.security.sessions");
  return (
    <div
      className="grid font-mono"
      style={{
        gridTemplateColumns: "36px minmax(140px, 1.4fr) minmax(120px, 1.2fr) 100px 80px",
        gap: "14px",
        background: "var(--color-bg-3)",
        padding: "10px 16px",
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 500,
      }}
    >
      <span></span>
      <span>{t("colDevice")}</span>
      <span>{t("colLocation")}</span>
      <span>{t("colLast")}</span>
      <span></span>
    </div>
  );
}

function Row({
  session,
  busy,
  onRevoke,
}: {
  session: ProfileSession;
  busy: boolean;
  onRevoke: () => void;
}) {
  const t = useTranslations("profile.security.sessions");

  const lastActive = new Date(session.lastActiveISO);
  const ageMs = Date.now() - lastActive.getTime();
  const lastLabel =
    ageMs < 60_000
      ? t("now")
      : ageMs < 3_600_000
        ? t("minutesAgo", { n: Math.floor(ageMs / 60_000).toString() })
        : ageMs < 86_400_000
          ? t("hoursAgo", { n: Math.floor(ageMs / 3_600_000).toString() })
          : lastActive.toLocaleDateString("hu-HU", {
              month: "short",
              day: "numeric",
            });

  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: "36px minmax(140px, 1.4fr) minmax(120px, 1.2fr) 100px 80px",
        gap: "14px",
        padding: "12px 16px",
        background: session.isCurrent
          ? "color-mix(in srgb, var(--color-good) 7%, var(--color-card))"
          : "transparent",
        borderTop:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <span
        className="grid place-items-center"
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "7px",
          background: "var(--color-bg-3)",
          color: "var(--color-ink-soft)",
        }}
      >
        <DeviceIcon device={session.device} />
      </span>
      <div>
        <div
          style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.005em" }}
        >
          {session.device}
        </div>
        <div
          className="font-mono truncate"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "2px",
          }}
        >
          {session.detail}
        </div>
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-ink-soft)",
          letterSpacing: "0.02em",
        }}
      >
        {session.location}
        <div
          className="font-mono"
          style={{ color: "var(--color-muted)", marginTop: "2px" }}
        >
          {session.ipMasked}
        </div>
      </div>
      {session.isCurrent ? (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-good)",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          ● {t("currentMarker")}
        </div>
      ) : (
        <div
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.03em",
          }}
        >
          {lastLabel}
        </div>
      )}
      {!session.isCurrent ? (
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            fontSize: "11px",
            color: "var(--color-danger)",
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: busy ? "not-allowed" : "pointer",
            textDecoration: "underline",
            textDecorationColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
          }}
        >
          {busy ? t("revoking") : t("revokeCta")}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function DeviceIcon({ device }: { device: string }) {
  const isPhone = /iphone|android|phone/i.test(device);
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true,
  };
  if (isPhone) {
    return (
      <svg {...common}>
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
