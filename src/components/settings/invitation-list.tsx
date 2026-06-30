"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, XCircle, RefreshCw } from "lucide-react";
import { InviteUserModal } from "./invite-user-modal";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { InvitationsData, InvitationItemData } from "@/lib/dal";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-ochre/15 text-ochre",
  ACCEPTED: "bg-good/10 text-good",
  EXPIRED: "bg-danger/10 text-danger",
  REVOKED: "bg-bg-2 text-muted",
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-ochre/10 text-ochre",
  BOARD_MEMBER: "bg-blue/10 text-blue",
  RESIDENT: "bg-good/10 text-good",
  TENANT: "bg-bg-2 text-ink-soft",
};

interface InvitationListProps {
  initialData: InvitationsData;
}

export function InvitationList({ initialData }: InvitationListProps) {
  const t = useTranslations("invitationManagement");
  const router = useRouter();
  const confirm = useConfirm();
  const [invitations, setInvitations] = useState<InvitationItemData[]>(initialData.invitations);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Client-side filtering when status filter changes
  const fetchFiltered = useCallback(async (filter: string) => {
    setLoading(true);
    try {
      const url = filter
        ? `/api/invitations?status=${filter}`
        : "/api/invitations";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (statusFilter) {
      fetchFiltered(statusFilter);
    } else {
      setInvitations(initialData.invitations);
    }
  }, [statusFilter, fetchFiltered, initialData.invitations]);

  async function handleResend(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitations/${id}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed");
        return;
      }
      toast.success(t("resendSuccess"));
      router.refresh();
    } catch {
      toast.error("Failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(id: string) {
    const ok = await confirm({ title: t("revokeConfirm"), danger: true });
    if (!ok) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitations/${id}/revoke`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed");
        return;
      }
      toast.success(t("revokeSuccess"));
      router.refresh();
    } catch {
      toast.error("Failed");
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getStatusKey(status: string) {
    const map: Record<string, string> = {
      PENDING: "statusPending",
      ACCEPTED: "statusAccepted",
      EXPIRED: "statusExpired",
      REVOKED: "statusRevoked",
    };
    return map[status] ?? status;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/90 transition-colors"
        >
          <Send className="h-4 w-4" />
          {t("inviteUser")}
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-tile-a bg-card px-3 py-2 text-sm text-ink-soft focus:border-blue focus:ring-1 focus:ring-blue"
        >
          <option value="">{t("allStatuses")}</option>
          <option value="PENDING">{t("statusPending")}</option>
          <option value="ACCEPTED">{t("statusAccepted")}</option>
          <option value="EXPIRED">{t("statusExpired")}</option>
          <option value="REVOKED">{t("statusRevoked")}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue" />
        </div>
      ) : invitations.length === 0 ? (
        <div className="rounded-lg border border-tile-a bg-card p-8 text-center text-sm text-muted">
          {t("noInvitations")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-tile-a bg-card">
          <table className="min-w-full divide-y divide-tile-a">
            <thead className="bg-bg-3">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("email")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("role")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("status")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("sentBy")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("sentAt")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("expiresAt")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tile-a">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-bg-3">
                  <td className="px-4 py-3 text-sm text-ink">
                    {inv.email}
                    {inv.unit && (
                      <span className="ml-2 text-xs text-muted">
                        (Unit {inv.unit.number})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {inv.role && (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          ROLE_STYLES[inv.role] ?? "bg-bg-2 text-ink-soft"
                        }`}
                      >
                        {inv.role.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[inv.status] ?? "bg-bg-2 text-muted"
                      }`}
                    >
                      {t(getStatusKey(inv.status))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-soft">
                    {inv.invitedBy?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-soft">
                    {formatDate(inv.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-soft">
                    {formatDate(inv.expiresAt)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={actionLoading === inv.id}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue hover:bg-blue/10 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === inv.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          {t("resend")}
                        </button>
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={actionLoading === inv.id}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" />
                          {t("revoke")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite User Modal */}
      {showModal && (
        <InviteUserModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
