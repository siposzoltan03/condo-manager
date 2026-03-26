"use client";

import { useTranslations } from "next-intl";
import { Lock, MessageSquare, ImageIcon, Clock } from "lucide-react";

interface ComplaintCardData {
  id: string;
  trackingNumber: string;
  category: string;
  description: string;
  photosCount: number;
  status: string;
  isPrivate: boolean;
  authorName: string;
  notesCount: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

interface ComplaintCardProps {
  complaint: ComplaintCardData;
  onClick: (id: string) => void;
}

export function ComplaintCard({ complaint, onClick }: ComplaintCardProps) {
  const t = useTranslations("complaints");

  const statusColor = STATUS_COLORS[complaint.status] ?? "bg-slate-100 text-slate-700";
  const date = new Date(complaint.createdAt).toLocaleDateString();

  return (
    <button
      onClick={() => onClick(complaint.id)}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">
              {complaint.trackingNumber}
            </span>
            {complaint.isPrivate && (
              <Lock className="h-3.5 w-3.5 text-slate-400" />
            )}
          </div>
          <div className="mb-1 text-xs font-medium text-slate-500">
            {t(`category_${complaint.category}`)}
          </div>
          <p className="line-clamp-2 text-sm text-slate-700">
            {complaint.description}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
        >
          {t(`status_${complaint.status}`)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {date}
        </span>
        <span>{complaint.authorName}</span>
        {complaint.notesCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {complaint.notesCount}
          </span>
        )}
        {complaint.photosCount > 0 && (
          <span className="flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            {complaint.photosCount}
          </span>
        )}
      </div>
    </button>
  );
}
