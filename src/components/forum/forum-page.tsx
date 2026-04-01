"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { CategorySidebar } from "./category-sidebar";
import { TopicList } from "./topic-list";
import type { ForumData } from "@/lib/dal";

const NewTopicForm = dynamic(() => import("./new-topic-form").then((m) => m.NewTopicForm));

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

interface ForumPageProps {
  initialData: ForumData;
}

export function ForumPage({ initialData }: ForumPageProps) {
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>(initialData.categories);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>(initialData.topics);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState("recent");
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

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
    if (hasInteracted) {
      fetchTopics();
    }
  }, [fetchTopics, hasInteracted]);

  function handleCategoryChange(categoryId: string | null) {
    setHasInteracted(true);
    setActiveCategoryId(categoryId);
    setPage(1);
  }

  function handleSortChange(newSort: string) {
    setHasInteracted(true);
    setSort(newSort);
    setPage(1);
  }

  function handleTopicCreated() {
    setShowNewTopic(false);
    setHasInteracted(true);
    setPage(1);
    fetchTopics();
    router.refresh();
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
