"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { TicketFilterBar } from "./TicketFilterBar";
import { TicketRow } from "./TicketRow";
import { ReportIssueModal } from "./ReportIssueModal";

interface TicketSummary {
  id: string;
  trackingNumber: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  reporter: { id: string; name: string };
  assignedContractor: { id: string; name: string } | null;
  createdAt: string;
}

interface TicketsResponse {
  tickets: TicketSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export function TicketList() {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (urgencyFilter) params.set("urgency", urgencyFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/maintenance/tickets?${params.toString()}`);
      if (res.ok) {
        const data: TicketsResponse = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, urgencyFilter, categoryFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleTicketClick(id: string) {
    router.push(`/maintenance/${id}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-extrabold text-[#002045]">
          {t("title")}
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90"
        >
          <Plus className="h-4 w-4" />
          {t("reportIssue")}
        </button>
      </div>

      {/* Filters */}
      <TicketFilterBar
        search={search}
        onSearchChange={handleSearch}
        statusFilter={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
        urgencyFilter={urgencyFilter}
        onUrgencyChange={(v) => { setUrgencyFilter(v); setPage(1); }}
        categoryFilter={categoryFilter}
        onCategoryChange={(v) => { setCategoryFilter(v); setPage(1); }}
      />

      {/* List */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{t("noTickets")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onClick={handleTicketClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {t("totalCount", { count: total })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 p-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-600">
              {t("pageOf", { page, totalPages })}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 p-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showForm && (
        <ReportIssueModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            setPage(1);
            fetchTickets();
          }}
        />
      )}
    </div>
  );
}
