"use client";

import { useTranslations, useLocale } from "next-intl";
import { Paperclip, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/format-time";

interface AnnouncementCardProps {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  authorName: string;
  authorRole: string;
  isRead: boolean;
  attachmentCount: number;
  readCount: number;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  BOARD_MEMBER: "Board Member",
  RESIDENT: "Resident",
  TENANT: "Tenant",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AnnouncementCard({
  id,
  title,
  body,
  targetAudience,
  authorName,
  authorRole,
  isRead,
  attachmentCount,
  readCount,
  createdAt,
}: AnnouncementCardProps) {
  const t = useTranslations("announcements");
  const locale = useLocale();

  const audienceLabel =
    targetAudience === "BOARD_ONLY" ? t("audienceBoardOnly") : t("audienceAll");
  const audienceStyle =
    targetAudience === "BOARD_ONLY"
      ? "bg-[#e2e7ff] text-[#43474e]"
      : "bg-[#d6e3ff] text-[#001b3c]";

  return (
    <Link href={`/announcements/${id}`} className="block">
      <div
        className={`rounded-2xl bg-white p-6 transition-shadow hover:shadow-md ${
          !isRead ? "border-l-4 border-[#002045]" : "opacity-90"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Author info */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a365d] text-sm font-bold text-white">
              {getInitials(authorName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{authorName}</span>
                <span className="text-xs text-slate-500">
                  {ROLE_LABELS[authorRole] ?? authorRole}
                </span>
              </div>
              <span className="text-xs uppercase tracking-wider text-slate-400">
                {formatTimeAgo(createdAt, locale)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audience tag */}
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${audienceStyle}`}
            >
              {audienceLabel}
            </span>
            {/* Unread dot */}
            {!isRead && (
              <span className="h-2.5 w-2.5 rounded-full bg-[#002045]" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className={`mt-4 font-manrope text-xl ${
            !isRead ? "font-bold" : "font-semibold"
          } text-slate-900`}
        >
          {title}
        </h3>

        {/* Body preview */}
        <p className="mt-2 line-clamp-2 text-[#515f74]">{body}</p>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {attachmentCount > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                {attachmentCount} {t("attachments")}
              </span>
            )}
            <span>
              {readCount} {t("views")}
            </span>
          </div>
          <span className="flex items-center gap-1 text-sm font-bold text-[#002045]">
            {t("readMore")} <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
