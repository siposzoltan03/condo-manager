"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Paperclip, Download } from "lucide-react";
import DOMPurify from "dompurify";
import Link from "next/link";

interface Attachment {
  name: string;
  url: string;
  size?: number;
}

interface AnnouncementData {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  attachments: Attachment[];
  author: { name: string; role: string };
  authorId: string;
  isRead: boolean;
  readCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
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

interface AnnouncementDetailProps {
  announcementId: string;
}

export function AnnouncementDetail({ announcementId }: AnnouncementDetailProps) {
  const t = useTranslations("announcements");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAndMarkRead() {
      try {
        const res = await fetch(`/api/announcements/${announcementId}`);
        if (!res.ok) throw new Error("Failed to fetch announcement");

        const data = await res.json();
        setAnnouncement(data);

        // Auto-mark as read
        await fetch(`/api/announcements/${announcementId}/read`, {
          method: "POST",
        });
      } catch {
        setError(tCommon("error"));
      } finally {
        setLoading(false);
      }
    }

    fetchAndMarkRead();
  }, [announcementId, tCommon]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">{error || t("notFound")}</p>
          <Link
            href="/announcements"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#002045]"
          >
            <ArrowLeft className="h-4 w-4" /> {t("backToList")}
          </Link>
        </div>
      </div>
    );
  }

  const audienceLabel =
    announcement.targetAudience === "BOARD_ONLY"
      ? t("audienceBoardOnly")
      : t("audienceAll");
  const audienceStyle =
    announcement.targetAudience === "BOARD_ONLY"
      ? "bg-[#e2e7ff] text-[#43474e]"
      : "bg-[#d6e3ff] text-[#001b3c]";

  const attachments = Array.isArray(announcement.attachments)
    ? (announcement.attachments as Attachment[])
    : [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/announcements"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#002045] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </Link>

      {/* Main content */}
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        {/* Author info */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a365d] text-sm font-bold text-white">
            {getInitials(announcement.author.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                {announcement.author.name}
              </span>
              <span className="text-sm text-slate-500">
                {ROLE_LABELS[announcement.author.role] ?? announcement.author.role}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {new Date(announcement.createdAt).toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Audience badge + read count */}
        <div className="mt-4 flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${audienceStyle}`}
          >
            {audienceLabel}
          </span>
          <span className="text-xs text-slate-400">
            {announcement.readCount} {t("views")}
          </span>
        </div>

        {/* Title */}
        <h1 className="mt-6 font-manrope text-3xl font-extrabold text-[#002045]">
          {announcement.title}
        </h1>

        {/* Body - rendered as HTML */}
        <div
          className="prose prose-slate mt-6 max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(announcement.body) }}
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Paperclip className="h-4 w-4" />
              {t("attachments")} ({attachments.length})
            </h3>
            <div className="mt-3 space-y-2">
              {attachments.map((attachment, index) => (
                <a
                  key={index}
                  href={attachment.url}
                  download
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  {attachment.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
