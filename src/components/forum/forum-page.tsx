"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CategorySidebar } from "./category-sidebar";
import { TopicList } from "./topic-list";
import { NewTopicForm } from "./new-topic-form";

interface Category {
  id: string;
  name: string;
  topicCount: number;
}

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

export function ForumPage() {
  const tCommon = useTranslations("common");

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recent");
  const [showNewTopic, setShowNewTopic] = useState(false);

  // Fetch categories
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/forum/categories");
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.categories);
        // Default to first category if available
        if (data.categories.length > 0) {
          setActiveCategoryId(data.categories[0].id);
        }
      } catch {
        // Silently handle
      }
    }
    load();
  }, []);

  // Fetch topics
  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategoryId) {
        params.set("categoryId", activeCategoryId);
      }
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/forum/topics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch topics");

      const data = await res.json();
      let topicList = data.topics as TopicItem[];

      if (sort === "top") {
        // Re-sort by reply count, keeping pinned first
        topicList = [...topicList].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.replyCount - a.replyCount;
        });
      }

      setTopics(topicList);
      setTotalPages(data.totalPages);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [activeCategoryId, page, sort]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  function handleCategoryChange(categoryId: string | null) {
    setActiveCategoryId(categoryId);
    setPage(1);
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    setPage(1);
  }

  function handleTopicCreated() {
    setShowNewTopic(false);
    setPage(1);
    fetchTopics();
  }

  if (categories.length === 0 && loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Category sidebar (inside main content, not the app sidebar) */}
      <CategorySidebar
        categories={categories}
        activeCategoryId={activeCategoryId}
        onCategoryChange={handleCategoryChange}
        onNewTopic={() => setShowNewTopic(true)}
      />

      {/* Main topic area */}
      <TopicList
        topics={topics}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        sort={sort}
        onSortChange={handleSortChange}
      />

      {/* New topic modal */}
      {showNewTopic && (
        <NewTopicForm
          categories={categories}
          defaultCategoryId={activeCategoryId}
          onClose={() => setShowNewTopic(false)}
          onSuccess={handleTopicCreated}
        />
      )}
    </div>
  );
}
