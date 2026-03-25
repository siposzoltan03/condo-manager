"use client";

import { Pin, MessageCircle } from "lucide-react";
import Link from "next/link";

interface PinnedTopicCardProps {
  id: string;
  title: string;
  authorName: string;
  categoryName: string;
  replyCount: number;
  lastActivityAt: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function PinnedTopicCard({
  id,
  title,
  authorName,
  categoryName,
  replyCount,
  lastActivityAt,
}: PinnedTopicCardProps) {
  return (
    <Link href={`/forum/${id}`} className="block">
      <div className="rounded-2xl bg-gradient-to-br from-[#002045] to-[#1a365d] p-5 text-white transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between">
          <Pin className="h-4 w-4 text-blue-300" />
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium">
            {categoryName}
          </span>
        </div>
        <h3 className="mt-3 font-manrope text-lg font-bold leading-tight line-clamp-2">
          {title}
        </h3>
        <div className="mt-3 flex items-center justify-between text-sm text-blue-200">
          <span>{authorName}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {replyCount}
            </span>
            <span>{formatTimeAgo(lastActivityAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
