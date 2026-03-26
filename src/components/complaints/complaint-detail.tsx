"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { StatusTimeline } from "./status-timeline";
import { ComplaintNotes } from "./complaint-notes";

interface NoteData {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string };
  createdAt: string;
}

interface ComplaintData {
  id: string;
  trackingNumber: string;
  category: string;
  description: string;
  photos: unknown;
  status: string;
  isPrivate: boolean;
  author: { id: string; name: string };
  authorId: string;
  notes: NoteData[];
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  oldValue: { status?: string } | null;
  newValue: { status?: string } | null;
  createdAt: string;
  user: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

const ALL_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

interface ComplaintDetailProps {
  complaintId: string;
}

export function ComplaintDetail({ complaintId }: ComplaintDetailProps) {
  const t = useTranslations("complaints");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const isBoardPlus = hasRole("BOARD_MEMBER");

  const [complaint, setComplaint] = useState<ComplaintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusChanges, setStatusChanges] = useState<
    { status: string; date: string; changedBy?: string }[]
  >([]);

  const fetchComplaint = useCallback(async () => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.back();
          return;
        }
        return;
      }
      const data = await res.json();
      setComplaint(data);

      // Build status timeline from audit logs
      // We always have SUBMITTED at creation
      const changes: { status: string; date: string; changedBy?: string }[] = [
        { status: "SUBMITTED", date: data.createdAt, changedBy: data.author.name },
      ];

      // Fetch audit logs for status changes
      try {
        const auditRes = await fetch(
          `/api/audit-logs?entityType=Complaint&entityId=${complaintId}`
        );
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          const logs = auditData.logs || [];
          logs
            .filter(
              (log: AuditEntry) =>
                log.newValue &&
                typeof log.newValue === "object" &&
                "status" in log.newValue
            )
            .reverse()
            .forEach((log: AuditEntry) => {
              if (log.newValue?.status) {
                changes.push({
                  status: log.newValue.status,
                  date: log.createdAt,
                  changedBy: log.user.name,
                });
              }
            });
        }
      } catch {
        // Audit logs optional; timeline still shows initial status
      }

      setStatusChanges(changes);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [complaintId, router]);

  useEffect(() => {
    fetchComplaint();
  }, [fetchComplaint]);

  async function handleStatusChange(newStatus: string) {
    if (!complaint || statusLoading) return;
    setStatusLoading(true);

    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchComplaint();
      }
    } catch {
      // Error handled silently
    } finally {
      setStatusLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{t("notFound")}</p>
      </div>
    );
  }

  const statusColor =
    STATUS_COLORS[complaint.status] ?? "bg-slate-100 text-slate-700";

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-sm text-slate-600 hover:text-[#002045]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-500">
                    {complaint.trackingNumber}
                  </span>
                  {complaint.isPrivate && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      {t("private")}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-[#002045]">
                  {t(`category_${complaint.category}`)}
                </h1>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}
              >
                {t(`status_${complaint.status}`)}
              </span>
            </div>

            <div className="mb-4 text-sm text-slate-500">
              {t("submittedBy", { name: complaint.author.name })} —{" "}
              {new Date(complaint.createdAt).toLocaleString()}
            </div>

            <div className="whitespace-pre-wrap text-sm text-slate-700">
              {complaint.description}
            </div>

            {Array.isArray(complaint.photos) && complaint.photos.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-slate-700">
                  {t("photos")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(complaint.photos as string[]).map((photo, i) => (
                    <div
                      key={i}
                      className="flex h-20 w-20 items-center justify-center rounded-md border border-slate-200 bg-slate-50"
                    >
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Board+ status management */}
            {isBoardPlus && (
              <div className="mt-6 border-t pt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("updateStatus")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={
                        s === complaint.status || statusLoading
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
                        STATUS_COLORS[s]
                      } ${
                        s === complaint.status
                          ? "opacity-100 ring-2 ring-offset-1 ring-slate-400"
                          : "opacity-60 hover:opacity-100"
                      } disabled:cursor-not-allowed`}
                    >
                      {t(`status_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <ComplaintNotes
            complaintId={complaintId}
            notes={complaint.notes}
            onNoteAdded={fetchComplaint}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-[#002045]">
              {t("statusTimeline")}
            </h3>
            <StatusTimeline changes={statusChanges} />
          </div>
        </div>
      </div>
    </div>
  );
}
