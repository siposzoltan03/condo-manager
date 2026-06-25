"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { TicketDetailData } from "@/lib/maintenance-dal";

interface Props {
  ticketId: string;
  status: TicketDetailData["status"];
  contractor: TicketDetailData["contractor"];
  options: TicketDetailData["contractorOptions"];
  isBoardPlus: boolean;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AssignContractorPanel({
  ticketId,
  status,
  contractor,
  options,
  isBoardPlus,
}: Props) {
  const t = useTranslations("maintenance");
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const isClosed = status === "COMPLETED" || status === "VERIFIED";
  const willRevertStatus = status === "ASSIGNED" || status === "IN_PROGRESS";

  async function postAssignment(contractorId: string | null) {
    const res = await fetch(`/api/maintenance/tickets/${ticketId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractorId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "assignment failed");
    }
  }

  async function handleAssign() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await postAssignment(selected);
      toast.success(
        contractor ? t("detail.changeToast") : t("detail.assignToast"),
      );
      setEditing(false);
      setSelected("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("detail.assignError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnassign() {
    const message = willRevertStatus
      ? t("detail.unassignConfirmRevert")
      : t("detail.unassignConfirm");
    const ok = await confirm({ title: message, danger: true });
    if (!ok) return;
    setUnassigning(true);
    try {
      await postAssignment(null);
      toast.success(t("detail.unassignToast"));
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("detail.assignError"),
      );
    } finally {
      setUnassigning(false);
    }
  }

  // Read-only view: residents, or board+ when not editing and ticket is closed.
  if (!isBoardPlus) {
    return <ReadOnlyAssignee contractor={contractor} t={t} />;
  }

  return (
    <div>
      {contractor && !editing ? (
        <>
          <div className="flex items-center gap-2.5">
            <span
              className="grid place-items-center flex-shrink-0"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "var(--color-bg-3)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              {initialsOf(contractor.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div style={{ fontSize: "13px", fontWeight: 600 }}>
                {contractor.name}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {contractor.specialty}
              </div>
            </div>
          </div>
          {!isClosed && (
            <div
              className="flex items-center gap-2"
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop:
                  "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
              }}
            >
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "var(--color-bg-3)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  color: "var(--color-ink)",
                  cursor: "pointer",
                }}
              >
                {t("detail.changeCta")}
              </button>
              <button
                type="button"
                onClick={handleUnassign}
                disabled={unassigning}
                className="font-mono"
                style={{
                  padding: "6px 0",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-danger)",
                  background: "transparent",
                  border: 0,
                  cursor: unassigning ? "not-allowed" : "pointer",
                  opacity: unassigning ? 0.5 : 1,
                  marginLeft: "auto",
                }}
              >
                {unassigning ? t("detail.unassigning") : t("detail.unassignCta")}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {!contractor && !editing && (
            <div
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.04em",
                fontStyle: "italic",
                marginBottom: "10px",
              }}
            >
              {t("kanban.unassigned")}
            </div>
          )}
          {!isClosed && (
            <>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--color-ink)",
                  background: "var(--color-bg-3)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              >
                <option value="">{t("detail.selectContractor")}</option>
                {options.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={c.id === contractor?.id}
                  >
                    {c.name} — {c.specialty}
                  </option>
                ))}
              </select>
              {options.length === 0 && (
                <div
                  className="font-mono"
                  style={{
                    fontSize: "10px",
                    color: "var(--color-muted)",
                    letterSpacing: "0.04em",
                    marginTop: "6px",
                  }}
                >
                  {t("detail.noContractors")}
                </div>
              )}
              <div
                className="flex items-center gap-2"
                style={{ marginTop: "10px" }}
              >
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={
                    submitting ||
                    !selected ||
                    selected === contractor?.id
                  }
                  className="inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    background: "var(--color-ink)",
                    color: "var(--color-bg)",
                    border: "1px solid var(--color-ink)",
                    cursor:
                      submitting || !selected || selected === contractor?.id
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {submitting
                    ? t("detail.assigning")
                    : contractor
                      ? t("detail.changeCta")
                      : t("detail.assignCta")}
                </button>
                {(contractor || editing) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setSelected("");
                    }}
                    disabled={submitting}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 500,
                      borderRadius: "8px",
                      background: "transparent",
                      border:
                        "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                      color: "var(--color-ink-soft)",
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {t("detail.cancel")}
                  </button>
                )}
              </div>
            </>
          )}
          {isClosed && (
            <ReadOnlyAssignee contractor={contractor} t={t} />
          )}
        </>
      )}
    </div>
  );
}

function ReadOnlyAssignee({
  contractor,
  t,
}: {
  contractor: TicketDetailData["contractor"];
  t: ReturnType<typeof useTranslations>;
}) {
  if (!contractor) {
    return (
      <div
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          fontStyle: "italic",
        }}
      >
        {t("kanban.unassigned")}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid place-items-center flex-shrink-0"
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          background: "var(--color-bg-3)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 700,
          fontSize: "13px",
        }}
      >
        {initialsOf(contractor.name)}
      </span>
      <div className="min-w-0">
        <div style={{ fontSize: "13px", fontWeight: 600 }}>
          {contractor.name}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {contractor.specialty}
        </div>
      </div>
    </div>
  );
}
