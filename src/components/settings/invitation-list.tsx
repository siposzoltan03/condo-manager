"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Send, XCircle, RefreshCw } from "lucide-react";
import { InviteUserModal } from "./invite-user-modal";

interface Invitation {
  id: string;
  email: string;
  type: string;
  role: string | null;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: { name: string } | null;
  unit: { number: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-700",
  REVOKED: "bg-slate-100 text-slate-500",
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  BOARD_MEMBER: "bg-blue-100 text-blue-700",
  RESIDENT: "bg-green-100 text-green-700",
  TENANT: "bg-slate-100 text-slate-700",
};

export function InvitationList() {
  const t = useTranslations("invitationManagement");
  const { hasRole } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const url = statusFilter
        ? `/api/invitations?status=${statusFilter}`
        : "/api/invitations";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      setToast({ message: "Failed to load invitations", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function handleResend(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitations/${id}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || "Failed", type: "error" });
        return;
      }
      setToast({ message: t("resendSuccess"), type: "success" });
      fetchInvitations();
    } catch {
      setToast({ message: "Failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitations/${id}/revoke`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || "Failed", type: "error" });
        return;
      }
      setToast({ message: t("revokeSuccess"), type: "success" });
      fetchInvitations();
    } catch {
      setToast({ message: "Failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  if (!hasRole("ADMIN")) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Access restricted to administrators.
      </div>
    );
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Send className="h-4 w-4" />
          {t("inviteUser")}
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setLoading(true);
            setStatusFilter(e.target.value);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : invitations.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {t("noInvitations")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("email")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("role")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("status")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("sentBy")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("sentAt")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("expiresAt")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {inv.email}
                    {inv.unit && (
                      <span className="ml-2 text-xs text-slate-500">
                        (Unit {inv.unit.number})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {inv.role && (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          ROLE_STYLES[inv.role] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {inv.role.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[inv.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t(getStatusKey(inv.status))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {inv.invitedBy?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(inv.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatDate(inv.expiresAt)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={actionLoading === inv.id}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
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
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
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
            fetchInvitations();
          }}
        />
      )}
    </div>
  );
}
