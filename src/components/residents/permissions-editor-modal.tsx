"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateBoardPermission } from "@/app/actions/board";
import { VotingModalShell } from "@/components/voting/voting-modal-shell";
import type { ResidentPermissionsData } from "@/lib/residents-dal";

interface Props {
  open: boolean;
  residentId: string | null;
  onClose: () => void;
}

export function PermissionsEditorModal({ open, residentId, onClose }: Props) {
  const t = useTranslations("residents.permissions");
  const tProfile = useTranslations("profile");
  const router = useRouter();

  const [data, setData] = useState<ResidentPermissionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !residentId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/residents/${residentId}/permissions`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "load_failed");
        }
        return res.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, residentId]);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
    }
  }, [open]);

  async function togglePermission(key: string, current: boolean) {
    if (!data) return;
    setSavingKey(key);
    // Optimistic.
    setData({
      ...data,
      permissions: data.permissions.map((p) =>
        p.key === key ? { ...p, granted: !current } : p,
      ),
    });
    try {
      const result = await updateBoardPermission({
        userBuildingId: data.userBuildingId,
        permissionKey: key,
        granted: !current,
      });
      if (result.error) {
        // Revert on failure.
        setData((prev) =>
          prev
            ? {
                ...prev,
                permissions: prev.permissions.map((p) =>
                  p.key === key ? { ...p, granted: current } : p,
                ),
              }
            : prev,
        );
        toast.error(result.error);
        return;
      }
      router.refresh();
    } catch {
      setData((prev) =>
        prev
          ? {
              ...prev,
              permissions: prev.permissions.map((p) =>
                p.key === key ? { ...p, granted: current } : p,
              ),
            }
          : prev,
      );
      toast.error(t("error"));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <VotingModalShell
      open={open}
      onClose={onClose}
      eyebrow={t("eyebrow")}
      title={data ? t("title", { name: data.residentName }) : t("titleFallback")}
      subtitle={
        data?.isBoard === false ? t("notBoardSubtitle") : t("subtitle")
      }
      accent="moss"
      maxWidth={520}
    >
      <div style={{ padding: "0 24px 22px", overflowY: "auto", flex: 1 }}>
        {loading && (
          <div
            className="font-mono"
            style={{
              padding: "32px 0",
              textAlign: "center",
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {t("loading")}
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </div>
        )}
        {data && data.permissions.length > 0 && (
          <div className="grid gap-2">
            {data.permissions.map((p) => {
              const label = tProfile(p.labelKey, { defaultMessage: p.key });
              const desc = p.descriptionKey
                ? tProfile(p.descriptionKey, { defaultMessage: "" })
                : "";
              return (
                <PermissionRow
                  key={p.key}
                  label={label}
                  description={desc}
                  granted={p.granted}
                  busy={savingKey === p.key}
                  disabled={!data.isBoard}
                  onToggle={() => togglePermission(p.key, p.granted)}
                />
              );
            })}
          </div>
        )}
      </div>
    </VotingModalShell>
  );
}

function PermissionRow({
  label,
  description,
  granted,
  busy,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  granted: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3"
      style={{
        padding: "12px 14px",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        borderRadius: "10px",
        background: granted
          ? "color-mix(in srgb, var(--color-moss-2) 6%, var(--color-card))"
          : "var(--color-card)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy || disabled}
        aria-pressed={granted}
        style={{
          flexShrink: 0,
          marginTop: "2px",
          width: "32px",
          height: "18px",
          borderRadius: "9px",
          background: granted
            ? "var(--color-ink)"
            : "color-mix(in srgb, var(--color-ink) 15%, transparent)",
          border: 0,
          position: "relative",
          cursor: busy || disabled ? "not-allowed" : "pointer",
          transition: "background 120ms",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "2px",
            left: granted ? "16px" : "2px",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "#fff",
            transition: "left 120ms",
          }}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{label}</div>
        {description && (
          <div
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              marginTop: "2px",
              textTransform: "uppercase",
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
