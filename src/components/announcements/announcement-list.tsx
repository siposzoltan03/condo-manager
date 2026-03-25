"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { AnnouncementCard } from "./announcement-card";
import { AnnouncementFilters } from "./announcement-filters";
import { AnnouncementForm } from "./announcement-form";
import { RoleGuard } from "@/components/auth/role-guard";

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  author: { name: string };
  isRead: boolean;
  readCount: number;
  attachmentCount: number;
  createdAt: string;
}

interface AnnouncementsResponse {
  announcements: AnnouncementItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function AnnouncementList() {
  const t = useTranslations("announcements");
  const tCommon = useTranslations("common");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (audienceFilter) params.set("audience", audienceFilter);

      const res = await fetch(`/api/announcements?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch announcements");

      const data: AnnouncementsResponse = await res.json();
      setAnnouncements(data.announcements);
      setTotalPages(data.totalPages);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [page, search, audienceFilter, tCommon]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  function handleAudienceChange(value: string) {
    setAudienceFilter(value);
    setPage(1);
  }

  function handleFormSuccess() {
    setShowForm(false);
    setPage(1);
    fetchAnnouncements();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-manrope text-4xl font-extrabold text-[#002045]">
            {t("title")}
          </h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>
        <RoleGuard role="BOARD_MEMBER">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#002045] px-6 py-3 text-sm font-medium text-white hover:bg-[#001530] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("newAnnouncement")}
          </button>
        </RoleGuard>
      </div>

      {/* Filters */}
      <AnnouncementFilters
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        audienceFilter={audienceFilter}
        onAudienceChange={handleAudienceChange}
      />

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Announcements */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{t("noAnnouncements")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              id={ann.id}
              title={ann.title}
              body={ann.body}
              targetAudience={ann.targetAudience}
              authorName={ann.author.name}
              authorRole="BOARD_MEMBER"
              isRead={ann.isRead}
              attachmentCount={ann.attachmentCount}
              readCount={ann.readCount}
              createdAt={ann.createdAt}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {t("pageOf", { page, totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <AnnouncementForm
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
