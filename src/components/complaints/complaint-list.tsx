"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { ComplaintCard } from "./complaint-card";
import { ComplaintFormModal } from "./complaint-form";

interface ComplaintSummary {
  id: string;
  trackingNumber: string;
  category: string;
  description: string;
  photosCount: number;
  status: string;
  isPrivate: boolean;
  authorName: string;
  authorId: string;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ComplaintsResponse {
  complaints: ComplaintSummary[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

const CATEGORIES = [
  "NOISE",
  "DAMAGE",
  "SAFETY",
  "PARKING",
  "OTHER",
];

export function ComplaintList() {
  const t = useTranslations("complaints");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/complaints?${params.toString()}`);
      if (res.ok) {
        const data: ComplaintsResponse = await res.json();
        setComplaints(data.complaints);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleCardClick(id: string) {
    router.push(`complaints/${id}`);
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
          {t("submitComplaint")}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        >
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status_${s}`)}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        >
          <option value="">{t("allCategories")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category_${c}`)}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{t("noComplaints")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <ComplaintCard
              key={c.id}
              complaint={c}
              onClick={handleCardClick}
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

      {/* Form modal */}
      {showForm && (
        <ComplaintFormModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            setPage(1);
            fetchComplaints();
          }}
        />
      )}
    </div>
  );
}
