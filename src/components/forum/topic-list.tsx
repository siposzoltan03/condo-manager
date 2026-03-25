"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PinnedTopicCard } from "./pinned-topic-card";
import { TopicRow } from "./topic-row";

interface TopicItem {
  id: string;
  title: string;
  categoryName: string;
  author: { name: string };
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  lastActivityAt: string;
}

interface TopicListProps {
  topics: TopicItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  sort: string;
  onSortChange: (sort: string) => void;
}

export function TopicList({
  topics,
  loading,
  page,
  totalPages,
  onPageChange,
  sort,
  onSortChange,
}: TopicListProps) {
  const t = useTranslations("forum");
  const tCommon = useTranslations("common");

  const pinnedTopics = topics.filter((t) => t.isPinned);
  const regularTopics = topics.filter((t) => !t.isPinned);

  // Generate page numbers for pagination
  const pageNumbers: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-manrope text-4xl font-extrabold text-[#002045]">
          {t("title")}
        </h1>
      </div>

      {/* Filter bar */}
      <div className="mt-4 flex items-center gap-3">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        >
          <option value="recent">{t("sortRecent")}</option>
          <option value="top">{t("sortTop")}</option>
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{t("noTopics")}</p>
        </div>
      ) : (
        <>
          {/* Pinned topics */}
          {pinnedTopics.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pinnedTopics.map((topic) => (
                <PinnedTopicCard
                  key={topic.id}
                  id={topic.id}
                  title={topic.title}
                  authorName={topic.author.name}
                  categoryName={topic.categoryName}
                  replyCount={topic.replyCount}
                  lastActivityAt={topic.lastActivityAt}
                />
              ))}
            </div>
          )}

          {/* Regular topics */}
          <div className="mt-4 space-y-2">
            {regularTopics.map((topic) => (
              <TopicRow
                key={topic.id}
                id={topic.id}
                title={topic.title}
                authorName={topic.author.name}
                categoryName={topic.categoryName}
                isLocked={topic.isLocked}
                replyCount={topic.replyCount}
                lastActivityAt={topic.lastActivityAt}
              />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {t("pageOf", { page, totalPages })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("previous")}
            </button>
            {pageNumbers.map((num) => (
              <button
                key={num}
                onClick={() => onPageChange(num)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  num === page
                    ? "bg-[#002045] text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
