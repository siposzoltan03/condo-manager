"use client";

import { useTranslations, useLocale } from "next-intl";
import { Lock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/format-time";

interface TopicRowProps {
  id: string;
  title: string;
  authorName: string;
  categoryName: string;
  isLocked: boolean;
  replyCount: number;
  lastActivityAt: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopicRow({
  id,
  title,
  authorName,
  categoryName,
  isLocked,
  replyCount,
  lastActivityAt,
}: TopicRowProps) {
  const t = useTranslations("forum");
  const locale = useLocale();

  return (
    <Link href={`/forum/${id}`} className="block">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 transition-shadow hover:shadow-md">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a365d] text-sm font-bold text-white">
          {getInitials(authorName)}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-[#002045]">{title}</h3>
            {isLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {t("postedBy")} {authorName} &middot; {categoryName}
          </p>
        </div>

        {/* Reply count */}
        <div className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500">
          <MessageCircle className="h-4 w-4" />
          <span>{replyCount} {t("replies")}</span>
        </div>

        {/* Last activity */}
        <div className="shrink-0 text-right text-sm text-slate-400">
          {formatTimeAgo(lastActivityAt, locale)}
        </div>
      </div>
    </Link>
  );
}
