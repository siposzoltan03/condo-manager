"use client";

import { useLocale } from "next-intl";
import { Pin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/format-time";

interface PinnedTopicCardProps {
  id: string;
  title: string;
  authorName: string;
  categoryName: string;
  replyCount: number;
  lastActivityAt: string;
}

export function PinnedTopicCard({
  id,
  title,
  authorName,
  categoryName,
  replyCount,
  lastActivityAt,
}: PinnedTopicCardProps) {
  const locale = useLocale();

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
            <span>{formatTimeAgo(lastActivityAt, locale)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
