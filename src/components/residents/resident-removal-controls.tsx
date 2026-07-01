"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ResidentProfileData } from "@/lib/residents-dal";
import {
  requestResidentRemoval,
  reviewResidentRemoval,
  cancelResidentRemoval,
} from "@/app/actions/resident-removal";

/**
 * Dual-control resident removal controls in the profile panel. Initiates a
 * removal (with reason) when none is pending; when one is pending, a DIFFERENT
 * board member can approve/reject, and the initiator can cancel.
 */
export function ResidentRemovalControls({
  profile,
  onChanged,
}: {
  profile: ResidentProfileData;
  onChanged: () => void;
}) {
  const t = useTranslations("residents.removal");
  const router = useRouter();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const {
    canRemove,
    isActive,
    isCurrentUser,
    role,
    pendingRemoval,
    currentUserId,
    userBuildingId,
    name,
  } = profile;

  if (!canRemove) return null;

  const isAdminTarget = role === "ADMIN" || role === "SUPER_ADMIN";

  async function run(fn: () => Promise<{ success?: boolean; error?: string }>) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      onChanged();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ── A removal is pending ──────────────────────────────────────────────
  if (pendingRemoval) {
    const isInitiator = pendingRemoval.requestedById === currentUserId;
    return (
      <div style={cardStyle("ochre")}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-ochre)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {t("pendingTitle")}
        </div>
        <p style={{ fontSize: "13px", color: "var(--color-ink-soft)", margin: "6px 0 0" }}>
          {t("pendingBy", { name: pendingRemoval.requesterName })}
        </p>
        <p style={{ fontSize: "13px", margin: "4px 0 0" }}>“{pendingRemoval.reason}”</p>
        <div className="flex flex-wrap gap-2" style={{ marginTop: "12px" }}>
          {isInitiator ? (
            <>
              <span style={{ fontSize: "12px", color: "var(--color-muted)", alignSelf: "center" }}>
                {t("awaitingApproval")}
              </span>
              <button type="button" disabled={busy} style={ghostBtn} onClick={() => run(() => cancelResidentRemoval({ requestId: pendingRemoval.id }))}>
                {t("cancel")}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} style={dangerBtn} onClick={() => run(() => reviewResidentRemoval({ requestId: pendingRemoval.id, approve: true }))}>
                {t("approve")}
              </button>
              <button type="button" disabled={busy} style={ghostBtn} onClick={() => run(() => reviewResidentRemoval({ requestId: pendingRemoval.id, approve: false }))}>
                {t("reject")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Already removed / not removable ───────────────────────────────────
  if (!isActive) {
    return (
      <div style={cardStyle("muted")}>
        <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>{t("removed")}</span>
      </div>
    );
  }
  if (isCurrentUser || isAdminTarget) return null;

  // ── Initiate ──────────────────────────────────────────────────────────
  return (
    <div style={cardStyle()}>
      {!reasonOpen ? (
        <button type="button" style={dangerGhostBtn} onClick={() => setReasonOpen(true)}>
          {t("removeCta")}
        </button>
      ) : (
        <div>
          <label style={{ fontSize: "12px", fontWeight: 600 }}>{t("reasonLabel", { name })}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t("reasonPlaceholder")}
            style={{ width: "100%", marginTop: "6px", padding: "8px 10px", borderRadius: "8px", fontSize: "13px", border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)", background: "var(--color-bg)", color: "var(--color-ink)", resize: "vertical" }}
          />
          <p className="font-mono" style={{ fontSize: "10.5px", color: "var(--color-muted)", margin: "6px 0 0", letterSpacing: "0.02em" }}>
            {t("dualControlNote")}
          </p>
          <div className="flex gap-2" style={{ marginTop: "10px" }}>
            <button
              type="button"
              disabled={busy || reason.trim().length === 0}
              style={{ ...dangerBtn, opacity: reason.trim().length === 0 ? 0.5 : 1 }}
              onClick={() =>
                run(async () => {
                  const r = await requestResidentRemoval({ targetUserBuildingId: userBuildingId, reason });
                  if (r.success) { setReasonOpen(false); setReason(""); }
                  return r;
                })
              }
            >
              {t("submitRequest")}
            </button>
            <button type="button" disabled={busy} style={ghostBtn} onClick={() => { setReasonOpen(false); setReason(""); }}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function cardStyle(accent?: "ochre" | "muted"): React.CSSProperties {
  const border =
    accent === "ochre"
      ? "color-mix(in srgb, var(--color-ochre) 35%, transparent)"
      : "color-mix(in srgb, var(--color-ink) 10%, transparent)";
  return {
    marginTop: "14px",
    padding: "14px 16px",
    borderRadius: "12px",
    border: `1px solid ${border}`,
    background: accent === "ochre" ? "color-mix(in srgb, var(--color-ochre) 6%, transparent)" : "var(--color-card)",
  };
}

const dangerBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
  background: "var(--color-danger)", color: "#fff", border: "none", cursor: "pointer",
};
const dangerGhostBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
  background: "transparent", color: "var(--color-danger)",
  border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)", cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
  background: "var(--color-card)", color: "var(--color-ink)",
  border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)", cursor: "pointer",
};
