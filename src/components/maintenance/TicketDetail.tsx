"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Paperclip } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { StatusTimeline } from "./StatusTimeline";
import { CommentsThread } from "./CommentsThread";

interface CommentData {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string };
  createdAt: string;
}

interface AttachmentData {
  id: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
}

interface TicketData {
  id: string;
  trackingNumber: string;
  title: string;
  description: string;
  category: string;
  location: string | null;
  urgency: string;
  status: string;
  reporter: { id: string; name: string };
  reporterId: string;
  assignedContractor: { id: string; name: string; specialty: string; contactInfo: string } | null;
  assignedContractorId: string | null;
  comments: CommentData[];
  attachments: AttachmentData[];
  createdAt: string;
  updatedAt: string;
}

interface ContractorOption {
  id: string;
  name: string;
  specialty: string;
}

interface AuditEntry {
  oldValue: { status?: string } | null;
  newValue: { status?: string } | null;
  createdAt: string;
  user: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  ACKNOWLEDGED: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  VERIFIED: "bg-emerald-100 text-emerald-800",
};

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  LOW: "bg-slate-100 text-slate-700",
};

// Valid workflow transitions
const NEXT_STATUS: Record<string, string> = {
  SUBMITTED: "ACKNOWLEDGED",
  ACKNOWLEDGED: "ASSIGNED",
  ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: "VERIFIED",
};

interface TicketDetailProps {
  ticketId: string;
}

export function TicketDetail({ ticketId }: TicketDetailProps) {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { hasRole } = useAuth();
  const isBoardPlus = hasRole("BOARD_MEMBER");
  const isAdmin = hasRole("ADMIN");

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusChanges, setStatusChanges] = useState<
    { status: string; date: string; changedBy?: string }[]
  >([]);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [selectedContractor, setSelectedContractor] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.back();
          return;
        }
        return;
      }
      const data = await res.json();
      setTicket(data);

      // Build status timeline
      const changes: { status: string; date: string; changedBy?: string }[] = [
        { status: "SUBMITTED", date: data.createdAt, changedBy: data.reporter.name },
      ];

      try {
        const auditRes = await fetch(
          `/api/audit-logs?entityType=MaintenanceTicket&entityId=${ticketId}`
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
        // Audit logs optional
      }

      setStatusChanges(changes);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [ticketId, router]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Fetch contractors for assignment
  useEffect(() => {
    if (!isBoardPlus) return;
    async function loadContractors() {
      try {
        const res = await fetch("/api/maintenance/contractors");
        if (res.ok) {
          const data = await res.json();
          setContractors(data.contractors || []);
        }
      } catch {
        // Silently handle
      }
    }
    loadContractors();
  }, [isBoardPlus]);

  async function handleStatusChange(newStatus: string) {
    if (!ticket || statusLoading) return;
    setStatusLoading(true);

    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchTicket();
      }
    } catch {
      // Error handled silently
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleAssign() {
    if (!selectedContractor || assignLoading) return;
    setAssignLoading(true);

    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractorId: selectedContractor }),
      });

      if (res.ok) {
        setSelectedContractor("");
        await fetchTicket();
      }
    } catch {
      // Error handled silently
    } finally {
      setAssignLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{t("notFound")}</p>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.SUBMITTED;
  const urgencyColor = URGENCY_COLORS[ticket.urgency] ?? URGENCY_COLORS.LOW;
  const nextStatus = NEXT_STATUS[ticket.status];

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
          {/* Header card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-500">
                    {ticket.trackingNumber}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${urgencyColor}`}>
                    {t(`urgency_${ticket.urgency}`)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {t(`category_${ticket.category}`)}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-[#002045]">
                  {ticket.title}
                </h1>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}>
                {t(`status_${ticket.status}`)}
              </span>
            </div>

            <div className="mb-4 text-sm text-slate-500">
              {t("submittedBy", { name: ticket.reporter.name })} —{" "}
              {new Date(ticket.createdAt).toLocaleString()}
            </div>

            {ticket.location && (
              <div className="mb-4 flex items-center gap-1 text-sm text-slate-600">
                <MapPin className="h-4 w-4" />
                {ticket.location}
              </div>
            )}

            <div className="whitespace-pre-wrap text-sm text-slate-700">
              {ticket.description}
            </div>

            {/* Attachments */}
            {ticket.attachments.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium text-slate-700">
                  {t("attachments")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <Paperclip className="h-4 w-4" />
                      {att.fileName}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Contractor info */}
            {ticket.assignedContractor && (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-medium text-slate-500">{t("contractor")}</span>
                <p className="text-sm font-medium text-slate-800">
                  {ticket.assignedContractor.name}
                </p>
                <p className="text-xs text-slate-500">
                  {ticket.assignedContractor.specialty} — {ticket.assignedContractor.contactInfo}
                </p>
              </div>
            )}

            {/* Board+ status workflow and assignment */}
            {isBoardPlus && (
              <div className="mt-6 border-t pt-4 space-y-4">
                {/* Status advance */}
                {nextStatus && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {t("updateStatus")}
                    </label>
                    <button
                      onClick={() => handleStatusChange(nextStatus)}
                      disabled={statusLoading}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium ${STATUS_COLORS[nextStatus]} hover:opacity-80 disabled:opacity-50`}
                    >
                      {statusLoading ? tCommon("loading") : t(`status_${nextStatus}`)}
                    </button>
                  </div>
                )}

                {/* Assign contractor */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    {t("assignContractor")}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedContractor}
                      onChange={(e) => setSelectedContractor(e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                    >
                      <option value="">{t("selectContractor")}</option>
                      {contractors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.specialty})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssign}
                      disabled={!selectedContractor || assignLoading}
                      className="rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
                    >
                      {assignLoading ? tCommon("loading") : t("assign")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comments */}
          <CommentsThread
            ticketId={ticketId}
            comments={ticket.comments}
            onCommentAdded={fetchTicket}
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
