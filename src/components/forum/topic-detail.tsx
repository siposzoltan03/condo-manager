"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatTimeAgo } from "@/lib/format-time";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pin, Lock, Unlock, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ReplyThread } from "./reply-thread";
import { ReplyForm } from "./reply-form";

interface TopicData {
  id: string;
  title: string;
  body: string;
  categoryId: string;
  category: { id: string; name: string };
  author: { name: string; role: string };
  authorId: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
}

interface ReplyItem {
  id: string;
  body: string;
  author: { name: string; role: string };
  authorId: string;
  parentReplyId: string | null;
  createdAt: string;
}

interface TopicDetailProps {
  topicId: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  BOARD_MEMBER: "Board Member",
  RESIDENT: "Resident",
  TENANT: "Tenant",
};

export function TopicDetail({ topicId }: TopicDetailProps) {
  const t = useTranslations("forum");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { user, hasRole } = useAuth();

  const [topic, setTopic] = useState<TopicData | null>(null);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reply state
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToAuthor, setReplyToAuthor] = useState<string>("");

  const fetchTopic = useCallback(async () => {
    try {
      const res = await fetch(`/api/forum/topics/${topicId}`);
      if (!res.ok) throw new Error("Failed to fetch topic");
      const data = await res.json();
      setTopic(data);
    } catch {
      setError(tCommon("error"));
    }
  }, [topicId, tCommon]);

  const fetchReplies = useCallback(async () => {
    try {
      const res = await fetch(`/api/forum/topics/${topicId}/replies?limit=100`);
      if (!res.ok) throw new Error("Failed to fetch replies");
      const data = await res.json();
      setReplies(data.replies);
    } catch {
      // Non-critical, topic still shows
    }
  }, [topicId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchTopic(), fetchReplies()]);
      setLoading(false);
    }
    load();
  }, [fetchTopic, fetchReplies]);

  async function handleTogglePin() {
    if (!topic) return;
    await fetch(`/api/forum/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !topic.isPinned }),
    });
    fetchTopic();
  }

  async function handleToggleLock() {
    if (!topic) return;
    await fetch(`/api/forum/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !topic.isLocked }),
    });
    fetchTopic();
  }

  async function handleDelete() {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/forum/topics/${topicId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/forum");
    }
  }

  function handleReplyTo(replyId: string, authorName: string) {
    setReplyToId(replyId);
    setReplyToAuthor(authorName);
  }

  function handleReplySuccess() {
    setReplyToId(null);
    setReplyToAuthor("");
    fetchReplies();
    fetchTopic();
  }

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-slate-500">{error || tCommon("error")}</p>
      </div>
    );
  }

  const isAdmin = hasRole("ADMIN");
  const isAuthor = user?.id === topic.authorId;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/forum")}
        className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#002045] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToForum")}
      </button>

      {/* Topic header */}
      <div className="rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1a365d] text-sm font-bold text-white">
              {getInitials(topic.author.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">
                  {topic.author.name}
                </span>
                <span className="text-xs text-slate-400">
                  {ROLE_LABELS[topic.author.role] ?? topic.author.role}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {formatTimeAgo(topic.createdAt, locale)} &middot; {topic.category.name}
              </span>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {topic.isPinned && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <Pin className="h-3 w-3" />
                {t("pinned")}
              </span>
            )}
            {topic.isLocked && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                <Lock className="h-3 w-3" />
                {t("locked")}
              </span>
            )}
          </div>
        </div>

        <h1 className="mt-4 font-manrope text-2xl font-extrabold text-[#002045]">
          {topic.title}
        </h1>
        <div className="mt-3 whitespace-pre-wrap text-slate-700">
          {topic.body}
        </div>

        {/* Admin controls */}
        {(isAdmin || isAuthor) && (
          <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
            {isAdmin && (
              <>
                <button
                  onClick={handleTogglePin}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Pin className="h-3.5 w-3.5" />
                  {topic.isPinned ? t("unpin") : t("pin")}
                </button>
                <button
                  onClick={handleToggleLock}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {topic.isLocked ? (
                    <Unlock className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  {topic.isLocked ? t("unlock") : t("lock")}
                </button>
              </>
            )}
            {(isAdmin || isAuthor) && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("deleteTopic")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Replies */}
      <div>
        <h2 className="mb-4 font-manrope text-lg font-bold text-[#002045]">
          {topic.replyCount} {t("replies")}
        </h2>
        <ReplyThread
          replies={replies}
          onReplyTo={handleReplyTo}
          isLocked={topic.isLocked}
        />
      </div>

      {/* Reply form */}
      <ReplyForm
        topicId={topicId}
        parentReplyId={replyToId}
        parentAuthorName={replyToAuthor}
        isLocked={topic.isLocked}
        onSuccess={handleReplySuccess}
        onCancelReply={() => {
          setReplyToId(null);
          setReplyToAuthor("");
        }}
      />
    </div>
  );
}
